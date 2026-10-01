from pathlib import Path
p=Path('docs/jidoshazei/index.html');s=p.read_text();old='<meta name="description" content="自家用乗用車の自動車税は排気量';new='<meta name="description" content="自家用乗用車の自動車税の早見表。税額は排気量';assert s.count(old)==1;s=s.replace(old,new);p.write_text(s)
