import sqlite3
import json
from cppp_scraper import fetch_and_parse

# 1. Fetch live data (5 pages = 50 rows)
print("Fetching 50 live rows from CPPP...")
tenders = fetch_and_parse(max_pages=5)

# 2. Setup SQLite In-Memory DB
conn = sqlite3.connect(':memory:')
cursor = conn.cursor()

cursor.execute('''
CREATE TABLE tenders (
    id INTEGER PRIMARY KEY,
    title TEXT,
    state TEXT,
    value REAL,
    deadline TEXT,
    category TEXT
)
''')

# 3. Insert Data
for t in tenders:
    cursor.execute('''
    INSERT INTO tenders (title, state, value, deadline, category)
    VALUES (?, ?, ?, ?, ?)
    ''', (
        t['title'],
        t['stateCodes'],
        t['estimatedValue'],
        t['submissionDeadline'].isoformat() if t['submissionDeadline'] else None,
        t['categoryCodes']
    ))
conn.commit()

# 4. Execute Queries and Generate Report
print("================ DATA QUALITY AUDIT REPORT ================\n")

# Query 1
cursor.execute("SELECT COUNT(*) FROM tenders;")
print("1. Total Rows Inserted:")
print(f"   => {cursor.fetchone()[0]}")

# Query 2
cursor.execute("SELECT state, COUNT(*) FROM tenders GROUP BY state ORDER BY COUNT(*) DESC LIMIT 20;")
print("\n2. State Distribution:")
for row in cursor.fetchall():
    print(f"   => {row[0]}: {row[1]}")

# Query 3
cursor.execute("SELECT COUNT(*) FROM tenders WHERE value IS NULL OR value = 0;")
print("\n3. Missing/Zero Values:")
print(f"   => {cursor.fetchone()[0]}")

# Query 4
cursor.execute("SELECT COUNT(*) FROM tenders WHERE deadline < datetime('now');")
print("\n4. Expired Deadlines:")
print(f"   => {cursor.fetchone()[0]}")

# Query 5
cursor.execute("SELECT category, COUNT(*) FROM tenders GROUP BY category ORDER BY COUNT(*) DESC LIMIT 10;")
print("\n5. Category Distribution:")
for row in cursor.fetchall():
    print(f"   => {row[0]}: {row[1]}")

# Query 6
cursor.execute("SELECT * FROM tenders LIMIT 3;")
print("\n6. Raw Row Sample:")
for row in cursor.fetchall():
    print(f"   => {row}")

conn.close()
