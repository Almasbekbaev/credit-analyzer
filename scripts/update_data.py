#!/usr/bin/env python3
"""Weekly update of public CBR key rate and industry RSS news. Stdlib only."""
import argparse
import datetime as dt
import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from html import unescape
from pathlib import Path

CBR_URL = "https://www.cbr.ru/hd_base/KeyRate/"
FEEDS = [
    ("РБК", "https://rssexport.rbc.ru/rbcnews/news/30/full.rss"),
    ("Коммерсантъ", "https://www.kommersant.ru/RSS/news.xml"),
]
TIMEOUT = 25
MAX_NEWS = 10


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "CreditAnalyzerDataBot/1.1 (+weekly public-data update)"})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return response.read()


def parse_date(text):
    text = str(text).strip()
    try:
        return dt.datetime.strptime(text, "%d.%m.%Y").date().isoformat()
    except ValueError:
        pass
    try:
        return dt.datetime.strptime(text[:25], "%a, %d %b %Y %H:%M:%S").date().isoformat()
    except ValueError:
        return dt.date.today().isoformat()


def get_key_rate():
    try:
        html = fetch(CBR_URL).decode("utf-8", errors="replace")
        rows = re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.I | re.S)
        rates = []
        for row in rows:
            cells = [unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.I | re.S)]
            if len(cells) >= 2 and re.fullmatch(r"\d{2}\.\d{2}\.\d{4}", cells[0]):
                try:
                    rates.append((parse_date(cells[0]), float(cells[1].replace(",", "."))))
                except ValueError:
                    continue
        if not rates:
            raise ValueError("Table rows not found")
        date, rate = max(rates, key=lambda item: item[0])
        print(f"CBR key rate: {rate}% ({date})")
        return {"cbrKeyRate": rate, "cbrKeyRateDate": date}
    except Exception as exc:
        print(f"Could not update CBR rate, keeping previous values: {exc}", file=sys.stderr)
        return {}


def collect_news(industries):
    result = {industry["id"]: [] for industry in industries}
    seen = set()
    for source, url in FEEDS:
        try:
            root = ET.fromstring(fetch(url))
            items = root.findall(".//item")
            for item in items:
                title = (item.findtext("title") or "").strip()
                link = (item.findtext("link") or "").strip()
                if not title or not link.startswith(("https://", "http://")):
                    continue
                date = parse_date(item.findtext("pubDate") or "")
                for industry in industries:
                    keys = industry.get("keywords") or [industry["name"]]
                    if any(key.lower() in title.lower() for key in keys) and link not in seen:
                        seen.add(link)
                        result[industry["id"]].append({"title": title, "link": link, "date": date, "source": source})
        except Exception as exc:
            print(f"Feed {source} failed: {exc}", file=sys.stderr)
        time.sleep(1)
    for industry in industries:
        result[industry["id"]].sort(key=lambda item: item["date"], reverse=True)
        result[industry["id"]] = result[industry["id"]][:MAX_NEWS]
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--offline", action="store_true", help="Only validate/normalize existing JSON without network requests")
    args = parser.parse_args()
    root = args.repo_root.resolve()
    data_dir = root / "data"
    today = dt.date.today().isoformat()
    benchmarks_path = data_dir / "benchmarks.json"
    news_path = data_dir / "news.json"
    benchmarks = json.loads(benchmarks_path.read_text(encoding="utf-8"))
    current_news = json.loads(news_path.read_text(encoding="utf-8")) if news_path.exists() else {}
    rate = {} if args.offline else get_key_rate()
    benchmarks.setdefault("meta", {}).update(rate)
    benchmarks["meta"]["updated"] = today if not args.offline else benchmarks["meta"].get("updated", today)
    benchmarks_path.write_text(json.dumps(benchmarks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.offline:
        collected = current_news.get("byIndustry", {})
    else:
        collected = collect_news(benchmarks["industries"])
        for industry in benchmarks["industries"]:
            if not collected.get(industry["id"]):
                collected[industry["id"]] = current_news.get("byIndustry", {}).get(industry["id"], [])[:MAX_NEWS]
    news = {"meta": {"updated": today if not args.offline else current_news.get("meta", {}).get("updated", today), "source": "РБК и Коммерсантъ RSS; при недоступности — предыдущие новости"}, "byIndustry": collected}
    news_path.write_text(json.dumps(news, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Data updated successfully.")


if __name__ == "__main__":
    main()
