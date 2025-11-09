import os
import json
import pandas as pd
import matplotlib.pyplot as plt
import argparse
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def fetch_accelerometer_data(date_str):
    sensor_type_id = '3b48eed5-6ece-4eb8-8c88-b5e645839385'
    query = (
        supabase.table("sensor_data")
        .select("*")
        .eq("sensor_type_id", sensor_type_id)
        .filter("timestamp", "gte", f"{date_str}T00:00:00")
        .filter("timestamp", "lt", f"{date_str}T23:59:59")
    )
    response = query.execute()
    return response.data

def fetch_gyroscope_data(date_str):
    sensor_type_id = 'd4ad2653-b430-40c2-9f47-bdc140119c57'
    query = (
        supabase.table("sensor_data")
        .select("*")
        .eq("sensor_type_id", sensor_type_id)
        .filter("timestamp", "gte", f"{date_str}T00:00:00")
        .filter("timestamp", "lt", f"{date_str}T23:59:59")
    )
    response = query.execute()
    return response.data

def parse_signals(data):
    xs, ys, zs = [], [], []
    for row in data:
        signal_json = row.get("data")
        if signal_json:
            try:
                # If it's already a dict, use it directly
                if isinstance(signal_json, dict):
                    signal = signal_json
                else:
                    signal = json.loads(signal_json)
                xs.append(signal.get("x", 0))
                ys.append(signal.get("y", 0))
                zs.append(signal.get("z", 0))
            except Exception as e:
                print(f"Error parsing signal: {e}")

    return xs, ys, zs

def parse_signals_to_dataframe(data):
    records = []
    for row in data:
        signal_json = row.get("data")
        if signal_json:
            if isinstance(signal_json, dict):
                signal = signal_json
            else:
                signal = json.loads(signal_json)
            records.append({
                "x": signal.get("x", 0),
                "y": signal.get("y", 0),
                "z": signal.get("z", 0),
                "timestamp": row.get("timestamp")
            })
    return pd.DataFrame(records)

def plot_signals_from_dataframe(df, title, filename):
    plt.figure(figsize=(12, 6))
    plt.plot(df.index, df["x"], label='X')
    plt.plot(df.index, df["y"], label='Y')
    plt.plot(df.index, df["z"], label='Z')
    plt.xlabel('Sample')
    plt.ylabel('Acceleration')
    plt.title(title)
    plt.legend()
    plt.tight_layout()
    plt.savefig(filename)
    print(f"Plot saved as {filename}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch and plot accelerometer data from Supabase")
    parser.add_argument("date", help="Date in YYYY-MM-DD format")
    args = parser.parse_args()

    accel_data = fetch_accelerometer_data(args.date)
    gyro_data = fetch_gyroscope_data(args.date)
    if not accel_data:
        print("No data found for the given date.")
        exit(0)
    if not gyro_data:
        print("No gyroscope data found for the given date.")
        exit(0)

    accel_df = parse_signals_to_dataframe(accel_data)
    plot_signals_from_dataframe(accel_df, "Accelerometer Signal", "accel_signal_plot.png")

    gyro_df = parse_signals_to_dataframe(gyro_data)
    plot_signals_from_dataframe(gyro_df, "Gyroscope Signal", "gyro_signal_plot.png")