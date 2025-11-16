import pandas as pd
from supabase import create_client, Client
import os
from dotenv import load_dotenv
import argparse

load_dotenv()

# Supabase credentials
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import gesture events to Supabase")
    parser.add_argument("xlsx_path", help="Path to the XLSX file")
    args = parser.parse_args()

    # Read XLSX file
    df = pd.read_excel(args.xlsx_path)

    # Iterate over rows and insert into Supabase
    for _, row in df.iterrows():
        event_data = {
            "e_ind": row["eInd"],
            "e_description_engl": row["eDescriptionENGL"],
            "e_description_slo": row["eDescriptionSLO"],
            "e_id": row["eID"],
            "e_description_butt": row["eDescriptionButt"],
            "notes": row["Notes"],
        }
        # Replace NaN or infinite values with None
        for k, v in event_data.items():
            if pd.isna(v) or (isinstance(v, float) and (v == float("inf") or v == float("-inf"))):
                event_data[k] = None
        supabase.table("event_codes").insert(event_data).execute()