import uuid
import datetime
import random
import json

user_id = "a0000009-0000-0000-0000-000000000009"
user_name = "Ken"

start_date = datetime.date(2025, 1, 1) # Wednesday

sql_statements = []

for i in range(52):
    week_start = start_date + datetime.timedelta(weeks=i)
    week_end = week_start + datetime.timedelta(days=6)
    
    # Format week range text (e.g., "1月1日 - 1月7日")
    week_range = f"{week_start.month}月{week_start.day}日 - {week_end.month}月{week_end.day}日"
    
    plan_id = str(uuid.uuid4())
    
    # Randomize data
    status = random.choice(['approved', 'approved', 'approved', 'pending'])
    total_hours = round(random.uniform(30.0, 45.0), 1)
    
    # Generate tasks
    tasks = []
    num_tasks = random.randint(3, 6)
    key_hours = 0
    
    for j in range(num_tasks):
        is_key = random.choice([True, True, False])
        category = "關鍵職責" if is_key else "其他事項"
        est_hours = round(random.uniform(2.0, 10.0), 1)
        actual_hours = round(est_hours * random.uniform(0.8, 1.2), 1)
        
        # New progress logic: 0, 50, 80, 100
        progress = random.choice([0, 50, 80, 100, 100, 100]) 
        
        if is_key:
            key_hours += est_hours
            
        task = {
            "id": str(uuid.uuid4()),
            "category": category,
            "priority": random.choice(["高", "中", "低"]),
            "name": f"執行專案開發任務 {j+1} - {week_range}",
            "outcome": f"完成階段性功能 {j+1} 並通過測試",
            "hours": est_hours,
            "actualHours": actual_hours,
            "progress": progress
        }
        if progress < 100:
            task["notDoneReason"] = "時間不足"
            
        tasks.append(task)
        
    key_ratio = round((key_hours / total_hours) * 100, 1) if total_hours > 0 else 0
    
    submitted_at = (week_start - datetime.timedelta(days=1)).isoformat() + "T10:00:00Z"
    
    tasks_json = json.dumps(tasks, ensure_ascii=False).replace("'", "''")
    review_comment = "本週執行狀況良好，繼續保持。" if status == 'approved' else ""
    
    sql = f"INSERT INTO weekly_plans (id, user_id, user_name, week_range, week_start, submitted_at, updated_at, status, review_comment, total_hours, key_ratio, tasks) VALUES ('{plan_id}', '{user_id}', '{user_name}', '{week_range}', '{week_start}', '{submitted_at}', '{submitted_at}', '{status}', '{review_comment}', {total_hours}, {key_ratio}, '{tasks_json}');"
    sql_statements.append(sql)

print("\n".join(sql_statements))
