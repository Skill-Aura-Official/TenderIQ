import subprocess
import os
import sys

def run_scraper(script_name, args=None):
    cmd = [sys.executable, script_name]
    if args:
        cmd.extend(args)
    print(f"--- Running {' '.join(cmd)} ---")
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(f"Success. Last 5 lines of output:\n" + "\n".join(result.stdout.strip().split('\n')[-5:]))
        return True
    except subprocess.CalledProcessError as e:
        print(f"FAILED. Exit code: {e.returncode}")
        print(f"Error output:\n{e.stderr}")
        return False

def main():
    print("=== TenderIQ Master Scraper Orchestrator ===")
    
    # 1. Run CPPP Scraper
    print("\n[1/2] Starting CPPP Scraper")
    run_scraper('cppp_scraper.py')
    
    # 2. Run GePNIC State Scrapers
    states = ['MH', 'UP', 'RJ', 'WB', 'MP', 'KA', 'TN', 'GJ', 'TG', 'HR', 'PB', 'KL', 'AP']
    print(f"\n[2/2] Starting State Scrapers ({len(states)} states)")
    
    success_count = 0
    failed_states = []
    
    for state in states:
        success = run_scraper('gepnic_scraper.py', ['--source', state])
        if success:
            success_count += 1
        else:
            failed_states.append(state)
            
    print("\n=== Orchestrator Summary ===")
    print(f"Total States Attempted: {len(states)}")
    print(f"Successful: {success_count}")
    if failed_states:
        print(f"Failed States: {', '.join(failed_states)}")
        
if __name__ == "__main__":
    # Change to scraper directory to ensure relative paths work
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    main()
