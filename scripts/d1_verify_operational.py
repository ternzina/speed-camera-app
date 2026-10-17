#!/usr/bin/env python3
"""Check the local operational database against the pinned master and R2 manifest."""
import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import d1_operational as d1

def main():
    report=d1.verify_operational(d1.ROOT,d1.DEFAULT_DATABASE,d1.PINNED_MASTER_KEY,d1.PUBLIC_MANIFEST,d1.PINNED)
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()
