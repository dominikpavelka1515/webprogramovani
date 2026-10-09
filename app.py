"""
ETS2 Logbook & Telemetry Dashboard - Flask Backend
Spustitelná aplikace pro správu vozového parku, evidenci tras a telemetrii v Euro Truck Simulatoru 2.
"""

from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
import database
import calculations

app = Flask(__name__)
app.secret_key = "ets2_secret_key_simulator_trucking_2026"

# Automatická inicializace databáze při startu
database.init_db()


# ------------------------------------------------------------------------------
# 1. HLAVNÍ STRÁNKA (DASHBOARD & STATISTIKY)
# ------------------------------------------------------------------------------
@app.route("/")
def dashboard():
    stats = database.get_dashboard_summary()
    recent_trips = database.get_all_trips(limit=5)
    trucks = database.get_all_trucks(active_only=True)
    return render_template(
        "dashboard.html",
        stats=stats,
        recent_trips=recent_trips,
        trucks=trucks
    )


# ------------------------------------------------------------------------------
# 2. LOGBOOK (ZÁZNAM TRAS A HISTORIE)
# ------------------------------------------------------------------------------
@app.route("/logbook", methods=["GET", "POST"])
def logbook():
    if request.method == "POST":
        try:
            truck_id = int(request.form.get("truck_id"))
            origin_city = request.form.get("origin_city", "").strip()
            destination_city = request.form.get("destination_city", "").strip()
            distance_km = float(request.form.get("distance_km"))
            cargo_name = request.form.get("cargo_name", "").strip()
            cargo_weight_t = float(request.form.get("cargo_weight_t", 0.0))
            revenue = float(request.form.get("revenue"))
            diesel_price_per_l = float(request.form.get("diesel_price_per_l", 1.45))
            cargo_type_id = request.form.get("cargo_type_id")
            notes = request.form.get("notes", "").strip()

            cargo_type_id = int(cargo_type_id) if cargo_type_id else None

            result = database.create_trip_with_calculation(
                truck_id=truck_id,
                origin_city=origin_city,
                destination_city=destination_city,
                distance_km=distance_km,
                cargo_name=cargo_name,
                cargo_weight_t=cargo_weight_t,
                revenue=revenue,
                diesel_price_per_l=diesel_price_per_l,
                cargo_type_id=cargo_type_id,
                notes=notes
            )
            flash(f"Trasa {origin_city} → {destination_city} úspěšně uložena! Čistý zisk: {result['net_profit']:.2f} €", "success")
            return redirect(url_for("logbook"))
        except Exception as e:
            flash(f"Chyba při ukládání zakázky: {str(e)}", "danger")

    trips = database.get_all_trips(limit=100)
    trucks = database.get_all_trucks(active_only=True)
    cargo_types = database.get_cargo_types()
    return render_template("logbook.html", trips=trips, trucks=trucks, cargo_types=cargo_types)


# ------------------------------------------------------------------------------
# 3. VOZOVÝ PARK (TRUCKS)
# ------------------------------------------------------------------------------
@app.route("/trucks", methods=["GET", "POST"])
def trucks():
    if request.method == "POST":
        try:
            brand = request.form.get("brand", "").strip()
            model = request.form.get("model", "").strip()
            license_plate = request.form.get("license_plate", "").strip().upper()
            tank_capacity_l = float(request.form.get("tank_capacity_l"))
            base_consumption = float(request.form.get("base_consumption_l_100km"))
            initial_odometer = float(request.form.get("current_odometer_km", 0.0))
            notes = request.form.get("notes", "").strip()

            database.create_truck(
                brand=brand,
                model=model,
                license_plate=license_plate,
                tank_capacity_l=tank_capacity_l,
                base_consumption_l_100km=base_consumption,
                current_odometer_km=initial_odometer,
                notes=notes
            )
            flash(f"Tahač {brand} {model} ({license_plate}) byl přidán do flotily!", "success")
            return redirect(url_for("trucks"))
        except Exception as e:
            flash(f"Chyba při přidávání tahače: {str(e)}", "danger")

    truck_list = database.get_all_trucks(active_only=False)
    return render_template("trucks.html", trucks=truck_list)


# ------------------------------------------------------------------------------
# 4. REST API: ŽIVÝ VÝPOČET SPOTŘEBY & ZISKU (Pro interaktivní frontend)
# ------------------------------------------------------------------------------
@app.route("/api/calculate", methods=["POST"])
def api_calculate():
    """
    Endpoint volaný AJAXem z klientského formuláře pro okamžitý náhled kalkulace v reálném čase.
    """
    try:
        data = request.get_json() or {}
        truck_id = int(data.get("truck_id", 0))
        distance_km = float(data.get("distance_km", 0.0))
        cargo_weight_t = float(data.get("cargo_weight_t", 0.0))
        diesel_price_per_l = float(data.get("diesel_price_per_l", 1.45))
        revenue = float(data.get("revenue", 0.0))

        if distance_km <= 0 or diesel_price_per_l <= 0:
            return jsonify({"success": False, "error": "Neplatné vstupní hodnoty"}), 400

        truck = database.get_truck_by_id(truck_id)
        if not truck:
            return jsonify({"success": False, "error": "Vyberte existující kamion"}), 404

        base_consumption = float(truck["base_consumption_l_100km"])
        metrics = calculations.calculate_trip_metrics(
            distance_km=distance_km,
            base_consumption=base_consumption,
            cargo_weight_t=cargo_weight_t,
            diesel_price_per_l=diesel_price_per_l,
            revenue=revenue
        )
        return jsonify({"success": True, "metrics": metrics})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


# ------------------------------------------------------------------------------
# 5. REST API: SMAZÁNÍ ZÁZNAMU
# ------------------------------------------------------------------------------
@app.route("/api/trips/<int:trip_id>", methods=["DELETE"])
def api_delete_trip(trip_id: int):
    success = database.delete_trip(trip_id)
    if success:
        return jsonify({"success": True, "message": "Záznam byl úspěšně smazán"})
    return jsonify({"success": False, "message": "Záznam nebyl nalezen"}), 404


# ------------------------------------------------------------------------------
# 6. REST API: PŘÍPRAVA PRO ETS2 TELEMETRY API
# ------------------------------------------------------------------------------
@app.route("/api/telemetry/job-finished", methods=["POST"])
def api_telemetry_job_finished():
    """
    Webhook připravený pro budoucí napojení na scs-sdk-plugin nebo ETS2 Telemetry Server.
    Přijímá telemetrický JSON při dokončení zakázky ve hře.
    """
    data = request.get_json() or {}
    # Nástin příjmu dat ze hry
    return jsonify({
        "status": "ready_for_ets2_sdk",
        "message": "Endpoint připraven pro příjem telemetrických dat z běžící hry.",
        "received_payload": data
    }), 200


if __name__ == "__main__":
    import sys
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    print("=======================================================")
    print("  ETS2 Logbook & Telemetry Dashboard bezi na localhost:")
    print("  http://127.0.0.1:5000")
    print("=======================================================")
    app.run(host="127.0.0.1", port=5000, debug=True)
