"""
Business logika a matematické modely pro kalkulace v ETS2 Logbooku.
"""

from typing import Dict, Any

# Koeficient přirážky spotřeby za každou tunu nákladu (litry na 100 km / tuna)
# V ETS2 plně naložená souprava (25 t) bere zhruba o 6 až 8 l/100km více než prázdný tahač.
CARGO_CONSUMPTION_PENALTY_PER_TON = 0.25


def calculate_effective_consumption(base_consumption: float, cargo_weight_t: float) -> float:
    """
    Vypočítá efektivní spotřebu s přihlédnutím k hmotnosti nákladu.
    Vzorec: base_consumption + (cargo_weight_t * 0.25)
    """
    effective = base_consumption + (cargo_weight_t * CARGO_CONSUMPTION_PENALTY_PER_TON)
    return round(max(effective, 1.0), 2)


def calculate_trip_metrics(
    distance_km: float,
    base_consumption: float,
    cargo_weight_t: float,
    diesel_price_per_l: float,
    revenue: float,
) -> Dict[str, float]:
    """
    Kompletní kalkulace parametrů jízdy:
    - Efektivní spotřeba (l/100 km)
    - Celkové spálené palivo (litry)
    - Celkové náklady na palivo
    - Čistý zisk (revenue - fuel_cost)
    - Čistý zisk na 1 km (net_profit / distance_km)
    - Náklady na 1 km (fuel_cost / distance_km)
    """
    if distance_km <= 0:
        raise ValueError("Vzdálenost musí být větší než 0 km.")
    if base_consumption <= 0:
        raise ValueError("Základní spotřeba musí být větší než 0 l/100km.")
    if diesel_price_per_l <= 0:
        raise ValueError("Cena nafty musí být větší než 0.")

    effective_consumption = calculate_effective_consumption(base_consumption, cargo_weight_t)
    
    # Spálené palivo: (Vzdálenost * Spotřeba) / 100
    fuel_consumed_l = (distance_km * effective_consumption) / 100.0
    
    # Náklady na palivo
    fuel_cost = fuel_consumed_l * diesel_price_per_l
    
    # Čistý zisk
    net_profit = revenue - fuel_cost
    
    # Metriky na 1 km
    profit_per_km = net_profit / distance_km
    fuel_cost_per_km = fuel_cost / distance_km

    return {
        "effective_consumption": round(effective_consumption, 2),
        "fuel_consumed_l": round(fuel_consumed_l, 2),
        "fuel_cost": round(fuel_cost, 2),
        "net_profit": round(net_profit, 2),
        "profit_per_km": round(profit_per_km, 2),
        "fuel_cost_per_km": round(fuel_cost_per_km, 2),
    }
