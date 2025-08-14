from flask import Flask, request, jsonify
from flask_cors import CORS  # ✅ ADDED: Import CORS
import openai
from dotenv import load_dotenv
import os
import json
import re
import pytz
from datetime import datetime, timedelta, time
from google.oauth2 import service_account
from googleapiclient.discovery import build
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# === CONFIGURATION ===
TIMEZONE = 'America/New_York'
GOOGLE_CREDS_FILE = 'google_creds.json'

# OpenAI client
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# === FLASK APP ===
app = Flask(__name__)

# ✅ ADDED: CORS configuration for Render deployment
CORS(app, origins=[
    "http://localhost:3000",  # Local development
    "https://*.onrender.com"  # Allow any Render subdomain
])

# ✅ ADDED: Health check endpoint for Render
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "message": "Voice Agent API is running"}), 200

# -------------------------------
# 1️⃣ Extract Lead Data from Transcript (GPT)
# -------------------------------
def extract_lead_data(transcript):
    system_prompt = "You are a helpful assistant that extracts structured lead data from sales call transcripts."
    user_prompt = f"""
Here is a transcript of a phone call between an AI assistant and a lead. Please extract the following as JSON:

- name
- phone_number
- email
- lead_warmth
- reason_for_call
- appointment_details
- appointment_preferences
- time_of_day_preference
- summary

Respond only with a JSON object.

Transcript:
\"\"\"{transcript}\"\"\"
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```json"):
            content = re.sub(r"^```json\s*|```$", "", content, flags=re.DOTALL)
        return json.loads(content)
    except Exception as e:
        return {"error": str(e)}

# -------------------------------
# 2️⃣ Google Calendar Booking Logic
# -------------------------------
def check_for_open_slot(service, start, end, duration_minutes):
    duration_minutes = int(duration_minutes)  # ✅ Ensure integer

    body = {
        "timeMin": start.isoformat(),
        "timeMax": end.isoformat(),
        "items": [{"id": 'primary'}],
    }
    busy_slots = service.freebusy().query(body=body).execute()['calendars']['primary']['busy']

    current = start
    while current + timedelta(minutes=duration_minutes) <= end:
        is_conflict = any(
            busy['start'] < (current + timedelta(minutes=duration_minutes)).isoformat() and
            busy['end'] > current.isoformat()
            for busy in busy_slots
        )
        if not is_conflict:
            return current, current + timedelta(minutes=duration_minutes)
        current += timedelta(minutes=15)

    return None

def find_open_slot(service, preferred_day=None, duration_minutes=30, time_of_day=None):
    duration_minutes = int(duration_minutes)  # ✅ Ensure integer

    tz = pytz.timezone(TIMEZONE)
    now = datetime.now(tz)

    TIME_WINDOWS = {
        "morning": (9, 12),
        "afternoon": (12, 17),
        "evening": (17, 20)
    }

    for i in range(1, 8):  # Start tomorrow
        candidate_day = now.date() + timedelta(days=i)

        if preferred_day is not None and candidate_day.weekday() != preferred_day:
            continue

        # 1️⃣ Try preferred time first
        if time_of_day in TIME_WINDOWS:
            hour_start, hour_end = TIME_WINDOWS[time_of_day]
            start = tz.localize(datetime.combine(candidate_day, time(hour_start)))
            end = tz.localize(datetime.combine(candidate_day, time(hour_end)))
            slot = check_for_open_slot(service, start, end, duration_minutes)
            if slot:
                return slot

        # 2️⃣ Fallback: full 9–5
        start = tz.localize(datetime.combine(candidate_day, time(9)))
        end = tz.localize(datetime.combine(candidate_day, time(17)))
        slot = check_for_open_slot(service, start, end, duration_minutes)
        if slot:
            return slot

    return None, None

def book_google_calendar_event(name, email, preferred_day=None, time_of_day=None):
    creds = service_account.Credentials.from_service_account_file(
        GOOGLE_CREDS_FILE, scopes=['https://www.googleapis.com/auth/calendar']
    )
    service = build('calendar', 'v3', credentials=creds)
    start_time, end_time = find_open_slot(service, preferred_day, 30, time_of_day)

    if not start_time:
        return None, None, None

    event = {
        'summary': f'Setup Call with {name}',
        'description': 'FrameTech AI Setup Call via Zoom',
        'start': {'dateTime': start_time.isoformat(), 'timeZone': TIMEZONE},
        'end': {'dateTime': end_time.isoformat(), 'timeZone': TIMEZONE},
    }

    created = service.events().insert(calendarId='primary', body=event, sendUpdates='all').execute()
    return created.get('htmlLink'), start_time, end_time

# -------------------------------
# 3️⃣ Webhook Endpoint with Fixed Logic
# -------------------------------
@app.route("/webhook", methods=["POST"])
def webhook():
    payload = request.get_json(force=True)
    message = payload.get('message', {})
    call_info = payload.get('call', {})

    if message.get('type') == 'end-of-call-report':
        transcript = message.get('transcript')
        if not transcript:
            return jsonify({"error": "Transcript is missing"}), 400

        # Parse the transcript with GPT
        lead_data = extract_lead_data(transcript)
        print("📤 GPT Response:", json.dumps(lead_data, indent=2))

        if isinstance(lead_data, dict) and "error" not in lead_data:
            # ✅ Apply defaults for missing fields
            name = lead_data.get("name") or "Unknown"
            phone_number = lead_data.get("phone_number") or call_info.get("from") or "Unknown"
            email = lead_data.get("email") or None
            lead_data["name"] = name
            lead_data["phone_number"] = phone_number
            lead_data["email"] = email
            lead_data["lead_warmth"] = lead_data.get("lead_warmth") or "cold"
            lead_data["reason_for_call"] = lead_data.get("reason_for_call") or "Unknown"
            lead_data["summary"] = lead_data.get("summary") or transcript[:200]

            # 🔧 FIXED: Initialize calendar fields as None/empty by default
            lead_data["calendar_link"] = None
            lead_data["appointment_start"] = None
            lead_data["appointment_end"] = None
            lead_data["reschedule_link"] = None

            # Determine booking intent
            reason = (lead_data.get("reason_for_call") or "").lower()
            prefs = (lead_data.get("appointment_preferences") or "").lower()
            time_of_day = (lead_data.get("time_of_day_preference") or "").lower()
            
            # 🔧 IMPROVED: Better booking detection
            appointment_details = (lead_data.get("appointment_details") or "").lower()
            
            # Check if they actually want to book
            booking_keywords = ["book", "schedule", "set up", "demo", "appointment", "meeting", "call"]
            should_book = (
                any(word in reason for word in booking_keywords) or
                any(word in prefs for word in booking_keywords) or
                any(word in appointment_details for word in booking_keywords)
            )

            print(f"🔍 Booking Analysis:")
            print(f"   Reason: '{reason}'")
            print(f"   Prefs: '{prefs}'")
            print(f"   Appointment details: '{appointment_details}'")
            print(f"   Should book: {should_book}")
            print(f"   Has name: {name != 'Unknown'}")
            print(f"   Has email: {email is not None}")

            # Convert day name to weekday index if mentioned
            preferred_day_index = None
            for i, day in enumerate(
                ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
            ):
                if day in prefs:
                    preferred_day_index = i
                    break

            # 🔧 FIXED: Only book if all conditions are met
            if should_book and name != "Unknown" and email:
                try:
                    calendar_link, start_time, end_time = book_google_calendar_event(
                        name, email, preferred_day_index, time_of_day
                    )
                    
                    # Only set calendar data if booking was successful
                    if calendar_link and start_time and end_time:
                        lead_data["calendar_link"] = calendar_link
                        lead_data["appointment_start"] = start_time.isoformat()
                        lead_data["appointment_end"] = end_time.isoformat()
                        lead_data["reschedule_link"] = "https://calendly.com/frametech/setup-call"
                        print(f"✅ Booking created for {name} at {start_time}")
                    else:
                        print("❌ Booking failed - no available slots")
                        
                except Exception as e:
                    print(f"❌ Booking error: {e}")
                    # Calendar fields remain None due to initialization above
            else:
                missing_requirements = []
                if not should_book:
                    missing_requirements.append("no booking intent detected")
                if name == "Unknown":
                    missing_requirements.append("no name provided")
                if not email:
                    missing_requirements.append("no email provided")
                    
                print(f"⚠️ No booking created: {', '.join(missing_requirements)}")

            # ✅ Always save the lead (with correct appointment status)
            try:
                result = supabase.table("leads").insert(lead_data).execute()
                print(f"💾 Lead saved to database")
            except Exception as e:
                print(f"❌ Database save error: {e}")

        return jsonify({"lead_data": lead_data})

    return jsonify({"status": "ignored"})

# ✅ UPDATED: Main section for Render deployment
if __name__ == "__main__":
    # Render deployment configuration
    port = int(os.environ.get("PORT", 3000))  # Keep your preferred port as fallback
    debug_mode = os.environ.get("FLASK_ENV") == "development"
    
    print(f"🚀 Starting Voice Agent API on port {port}")
    print(f"🔧 Debug mode: {debug_mode}")
    app.run(host="0.0.0.0", port=port, debug=debug_mode)