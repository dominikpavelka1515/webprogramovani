"""
Databázová vrstva SQLite pro ETS2 Logbook.
Obsahuje inicializaci databáze, transakční metody pro zápis jízd a agregace statistik.
"""

import os
import sqlite3
from typing import Dict, Any, List, Optional
from calculations import calculate_trip_metrics

DB_PATH = os.path.join(os.path.dirname(__file__), "ets2_logbook.db")
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")


def get_db_connection() -> sqlite3.Connection:
    """Vrátí spojení s SQLite databází s aktivovanou podporou cizích klíčů a Row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    """Inicializuje schéma databáze a nahraje výchozí číselníky a testovací data."""
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    with get_db_connection() as conn:
        conn.executescript(schema_sql)
        
        # Výchozí číselník kategorií nákladů
        cargo_types = [
            ("Standardní zboží", None, 0),
            ("Těžká technika / Heavy Cargo", None, 0),
            ("Nebezpečný náklad (ADR)", "ADR Class 1-9", 0),
            ("Křehký náklad (Elektronika / Sklo)", None, 1),
            ("Chlazené potraviny", None, 0),
            ("Sypký materiál (Cisterna / Sklápěč)", None, 0),
        ]
        conn.executemany(
            """
            INSERT OR IGNORE INTO cargo_types (name, hazard_class, is_fragile)
            VALUES (?, ?, ?)
            """,
            cargo_types
        )
        
        # Pokud ještě nemáme žádný tahač, vytvoříme dva ikonické ETS2 tahače
        truck_count = conn.execute("SELECT COUNT(*) FROM trucks").fetchone()[0]
        if truck_count == 0:
            sample_trucks = [
                ("Scania", "S 730 V8 Highline", "1AB 8899", 1400.0, 32.5, 12540.0, "Topline kabina, V8 King of the Road edice"),
                ("Volvo", "FH16 750 Globetrotter XL", "2CZ 4421", 1380.0, 31.0, 8920.0, "Silný tahač na těžké nadrozměrné náklady"),
                ("MAN", "TGX 18.640 Individual Lion", "3EX 7711", 1160.0, 29.8, 4310.0, "Dálková přeprava, komfortní kabina"),
            ]
            conn.executemany(
                """
                INSERT INTO trucks (brand, model, license_plate, tank_capacity_l, base_consumption_l_100km, current_odometer_km, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                sample_trucks
            )
            
            # Vložíme 2 vzorové jízdy pro okamžitou demonstraci dashboardu
            sample_trips = [
                (1, "Praha", "Rotterdam", 890.0, 2, "Mobilní jeřáb", 24.5, 2850.0, 1.45, 38.63, 343.8, 498.51, 2351.49, 11650.0, 12540.0, "Hladký přejezd přes Německo bez pokut"),
                (2, "Bratislava", "Mnichov", 510.0, 4, "Lékařská technika", 8.2, 1680.0, 1.42, 33.05, 168.56, 239.36, 1440.64, 8410.0, 8920.0, "Dodáno včas v noci"),
            ]
            conn.executemany(
                """
                INSERT INTO trips (
                    truck_id, origin_city, destination_city, distance_km,
                    cargo_type_id, cargo_name, cargo_weight_t, revenue, diesel_price_per_l,
                    effective_consumption_l_100km, fuel_consumed_l, fuel_cost, net_profit,
                    odometer_start_km, odometer_end_km, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                sample_trips
            )
            conn.commit()


# ------------------------------------------------------------------------------
# Správa tahačů (Trucks)
# ------------------------------------------------------------------------------
def get_all_trucks(active_only: bool = True) -> List[sqlite3.Row]:
    query = "SELECT * FROM trucks"
    if active_only:
        query += " WHERE is_active = 1"
    query += " ORDER BY brand ASC, model ASC"
    with get_db_connection() as conn:
        return conn.execute(query).fetchall()


def get_truck_by_id(truck_id: int) -> Optional[sqlite3.Row]:
    with get_db_connection() as conn:
        return conn.execute("SELECT * FROM trucks WHERE id = ?", (truck_id,)).fetchone()


def create_truck(
    brand: str,
    model: str,
    license_plate: str,
    tank_capacity_l: float,
    base_consumption_l_100km: float,
    current_odometer_km: float = 0.0,
    notes: str = ""
) -> int:
    with get_db_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO trucks (brand, model, license_plate, tank_capacity_l, base_consumption_l_100km, current_odometer_km, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (brand.strip(), model.strip(), license_plate.strip().upper(), tank_capacity_l, base_consumption_l_100km, current_odometer_km, notes.strip())
        )
        conn.commit()
        return cursor.lastrowid


# ------------------------------------------------------------------------------
# Číselník nákladů
# ------------------------------------------------------------------------------
def get_cargo_types() -> List[sqlite3.Row]:
    with get_db_connection() as conn:
        return conn.execute("SELECT * FROM cargo_types ORDER BY name ASC").fetchall()


# ------------------------------------------------------------------------------
# Záznam tras (Logbook) a automatické transakce
# ------------------------------------------------------------------------------
def create_trip_with_calculation(
    truck_id: int,
    origin_city: str,
    destination_city: str,
    distance_km: float,
    cargo_name: str,
    cargo_weight_t: float,
    revenue: float,
    diesel_price_per_l: float,
    cargo_type_id: Optional[int] = None,
    notes: str = ""
) -> Dict[str, Any]:
    """
    Atomická transakce:
    1. Získá kamion a jeho stávající parametry a tachometr.
    2. Provede kalkulaci spotřeby, paliva, nákladů a čistého zisku.
    3. Vloží nový záznam do tabulky trips se stavem tachometru před i po.
    4. Aktualizuje stav tachometru daného kamionu (current_odometer_km).
    """
    with get_db_connection() as conn:
        # Uzamčení pro konzistentní stav tachometru
        truck = conn.execute("SELECT * FROM trucks WHERE id = ?", (truck_id,)).fetchone()
        if not truck:
            raise ValueError(f"Kamion s ID {truck_id} nebyl nalezen.")

        base_consumption = float(truck["base_consumption_l_100km"])
        odometer_start = float(truck["current_odometer_km"])
        odometer_end = odometer_start + float(distance_km)

        metrics = calculate_trip_metrics(
            distance_km=float(distance_km),
            base_consumption=base_consumption,
            cargo_weight_t=float(cargo_weight_t),
            diesel_price_per_l=float(diesel_price_per_l),
            revenue=float(revenue)
        )

        cursor = conn.execute(
            """
            INSERT INTO trips (
                truck_id, origin_city, destination_city, distance_km,
                cargo_type_id, cargo_name, cargo_weight_t, revenue, diesel_price_per_l,
                effective_consumption_l_100km, fuel_consumed_l, fuel_cost, net_profit,
                odometer_start_km, odometer_end_km, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                truck_id,
                origin_city.strip(),
                destination_city.strip(),
                distance_km,
                cargo_type_id if cargo_type_id else None,
                cargo_name.strip(),
                cargo_weight_t,
                revenue,
                diesel_price_per_l,
                metrics["effective_consumption"],
                metrics["fuel_consumed_l"],
                metrics["fuel_cost"],
                metrics["net_profit"],
                odometer_start,
                odometer_end,
                notes.strip()
            )
        )
        trip_id = cursor.lastrowid

        # Aktualizace tachometru kamionu
        conn.execute(
            "UPDATE trucks SET current_odometer_km = ? WHERE id = ?",
            (odometer_end, truck_id)
        )
        conn.commit()

        metrics["trip_id"] = trip_id
        metrics["odometer_start_km"] = odometer_start
        metrics["odometer_end_km"] = odometer_end
        return metrics


def get_all_trips(limit: int = 100) -> List[sqlite3.Row]:
    query = """
        SELECT 
            t.*,
            tr.brand AS truck_brand,
            tr.model AS truck_model,
            tr.license_plate AS truck_plate,
            ct.name AS cargo_category
        FROM trips t
        JOIN trucks tr ON t.truck_id = tr.id
        LEFT JOIN cargo_types ct ON t.cargo_type_id = ct.id
        ORDER BY t.completed_at DESC, t.id DESC
        LIMIT ?
    """
    with get_db_connection() as conn:
        return conn.execute(query, (limit,)).fetchall()


def delete_trip(trip_id: int) -> bool:
    with get_db_connection() as conn:
        cursor = conn.execute("DELETE FROM trips WHERE id = ?", (trip_id,))
        conn.commit()
        return cursor.rowcount > 0


# ------------------------------------------------------------------------------
# Dashboard Agregace a Statistiky
# ------------------------------------------------------------------------------
def get_dashboard_summary() -> Dict[str, Any]:
    with get_db_connection() as conn:
        # Základní souhrnné metriky
        stats = conn.execute(
            """
            SELECT 
                COUNT(*) AS total_trips,
                COALESCE(SUM(distance_km), 0) AS total_distance_km,
                COALESCE(SUM(fuel_consumed_l), 0) AS total_fuel_l,
                COALESCE(SUM(fuel_cost), 0) AS total_fuel_cost,
                COALESCE(SUM(revenue), 0) AS total_revenue,
                COALESCE(SUM(net_profit), 0) AS total_net_profit,
                COALESCE(AVG(effective_consumption_l_100km), 0) AS avg_consumption
            FROM trips
            """
        ).fetchone()

        # Nejpoužívanější kamion
        most_used_truck = conn.execute(
            """
            SELECT 
                tr.brand, tr.model, tr.license_plate,
                COUNT(t.id) AS trips_count,
                COALESCE(SUM(t.distance_km), 0) AS driven_km
            FROM trucks tr
            LEFT JOIN trips t ON tr.id = t.truck_id
            GROUP BY tr.id
            ORDER BY trips_count DESC, driven_km DESC
            LIMIT 1
            """
        ).fetchone()

        # Nejziskovější trasa (origin -> destination)
        top_route = conn.execute(
            """
            SELECT 
                origin_city, destination_city,
                COUNT(*) AS count,
                SUM(net_profit) AS total_profit,
                AVG(net_profit) AS avg_profit,
                SUM(distance_km) AS total_km
            FROM trips
            GROUP BY origin_city, destination_city
            ORDER BY total_profit DESC
            LIMIT 1
            """
        ).fetchone()

        # Posledních 10 jízd pro graf
        recent_trips_for_chart = conn.execute(
            """
            SELECT 
                id, 
                origin_city || ' -> ' || destination_city AS route_label,
                distance_km, 
                net_profit, 
                fuel_cost,
                effective_consumption_l_100km,
                strftime('%d.%m.', completed_at) AS trip_date
            FROM trips
            ORDER BY id ASC
            LIMIT 15
            """
        ).fetchall()

        return {
            "total_trips": stats["total_trips"],
            "total_distance_km": round(stats["total_distance_km"], 1),
            "total_fuel_l": round(stats["total_fuel_l"], 1),
            "total_fuel_cost": round(stats["total_fuel_cost"], 2),
            "total_revenue": round(stats["total_revenue"], 2),
            "total_net_profit": round(stats["total_net_profit"], 2),
            "avg_consumption": round(stats["avg_consumption"], 2),
            "most_used_truck": dict(most_used_truck) if most_used_truck and most_used_truck["trips_count"] > 0 else None,
            "top_route": dict(top_route) if top_route else None,
            "chart_labels": [r["route_label"] for r in recent_trips_for_chart],
            "chart_profits": [round(r["net_profit"], 2) for r in recent_trips_for_chart],
            "chart_fuel_costs": [round(r["fuel_cost"], 2) for r in recent_trips_for_chart],
            "chart_distances": [round(r["distance_km"], 1) for r in recent_trips_for_chart],
        }
