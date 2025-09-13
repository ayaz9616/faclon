import json
import os

# Path to the operational_schedule.json
schedule_path = os.path.join(os.getcwd(), 'public', 'config', 'operational_schedule.json')

with open(schedule_path, 'r') as f:
    data = json.load(f)

def time_to_sec(t):
    if t == "99:99:99":
        return float('inf')
    parts = t.split(':')
    h = int(parts[0])
    m = int(parts[1]) if len(parts) > 1 else 0
    s = int(parts[2]) if len(parts) > 2 else 0
    return h * 3600 + m * 60 + s

def sec_to_time(s):
    if s == float('inf'):
        return "99:99:99"
    h = s // 3600
    m = (s % 3600) // 60
    sec = s % 60
    return f"{h:02d}:{m:02d}:{sec:02d}"

for train in data['train_roster']:
    mission_plan = train['mission_plan']
    if not mission_plan:
        continue

    # Collect all times
    times_sec = []
    for mission in mission_plan:
        arrival = mission['scheduled_arrival_time']
        departure = mission['scheduled_departure_time']
        times_sec.append(time_to_sec(arrival))
        times_sec.append(time_to_sec(departure))

    min_time = min(times_sec)
    max_time = max(times_sec)
    duration = max_time - min_time

    if duration == 0:
        continue

    new_start = time_to_sec("08:00:00")
    new_end = time_to_sec("08:02:00")
    new_duration = new_end - new_start
    scale = new_duration / duration

    for mission in mission_plan:
        arrival_sec = time_to_sec(mission['scheduled_arrival_time'])
        departure_sec = time_to_sec(mission['scheduled_departure_time'])

        new_arrival_sec = new_start + (arrival_sec - min_time) * scale
        new_departure_sec = new_start + (departure_sec - min_time) * scale

        # Round and clamp
        new_arrival_sec = max(new_start, min(new_end, round(new_arrival_sec)))
        new_departure_sec = max(new_start, min(new_end, round(new_departure_sec)))

        mission['scheduled_arrival_time'] = sec_to_time(new_arrival_sec)
        mission['scheduled_departure_time'] = sec_to_time(new_departure_sec)

with open(schedule_path, 'w') as f:
    json.dump(data, f, indent=2)

print("Schedule modified successfully.")