from flask import Flask, jsonify, render_template, request
import requests
import xml.etree.ElementTree as ET
import re
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# In-memory cache
feed_cache = {
    "data": None,
    "last_fetched": None
}

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_EXPIRY_SECONDS = 1800  # 30 minutes

def clean_text(html_content):
    """Strip HTML tags and clean up whitespace for Twitter/text representation."""
    if not html_content:
        return ""
    # Strip HTML tags
    text = re.sub(r'<[^>]+>', '', html_content)
    # Replace multiple spaces/newlines with a single space
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def parse_release_notes(xml_content):
    """Parse Atom XML feed and extract individual release note entries and updates."""
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        logger.error(f"Failed to parse XML: {e}")
        return None

    parsed_entries = []
    
    for entry in root.findall("atom:entry", ns):
        title = entry.find("atom:title", ns).text
        updated_str = entry.find("atom:updated", ns).text
        id_val = entry.find("atom:id", ns).text
        
        # Extract alternate link, fallback to any link
        link_elem = entry.find("atom:link[@rel='alternate']", ns)
        if link_elem is None:
            link_elem = entry.find("atom:link", ns)
        link = link_elem.attrib.get("href") if link_elem is not None else ""
        
        content_elem = entry.find("atom:content", ns)
        content_html = content_elem.text if content_elem is not None else ""
        
        # Attempt to split the HTML content by <h3> headings (e.g. <h3>Feature</h3>)
        updates = []
        if content_html:
            # Matches: <h3>Category</h3> followed by description up to the next <h3> or end of content
            pattern = re.compile(r'<h3>(.*?)</h3>(.*?)(?=<h3>|$)', re.DOTALL | re.IGNORECASE)
            matches = pattern.findall(content_html)
            
            for index, (update_type, update_desc) in enumerate(matches):
                update_type = update_type.strip()
                update_desc = update_desc.strip()
                text_desc = clean_text(update_desc)
                
                updates.append({
                    "id": f"{id_val}#item-{index}",
                    "type": update_type,
                    "html": update_desc,
                    "text": text_desc
                })
        
        # Fallback if no specific sections were matched
        if not updates:
            text_desc = clean_text(content_html)
            updates.append({
                "id": f"{id_val}#item-0",
                "type": "Update",
                "html": content_html,
                "text": text_desc
            })
            
        parsed_entries.append({
            "title": title,
            "updated": updated_str,
            "link": link,
            "updates": updates
        })
        
    return parsed_entries

def fetch_feed(force_refresh=False):
    """Fetch and parse feed, using cache if available and not expired."""
    now = datetime.now()
    
    # Check cache validity
    if not force_refresh and feed_cache["data"] is not None and feed_cache["last_fetched"] is not None:
        elapsed = (now - feed_cache["last_fetched"]).total_seconds()
        if elapsed < CACHE_EXPIRY_SECONDS:
            logger.info("Serving from cache")
            return feed_cache["data"], False
            
    logger.info("Fetching fresh feed from source")
    try:
        headers = {
            "User-Agent": "BigQueryReleasePulse/1.0 (Flask Web Application)"
        }
        response = requests.get(FEED_URL, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = parse_release_notes(response.content)
        if data:
            feed_cache["data"] = data
            feed_cache["last_fetched"] = now
            return data, True
        else:
            # Fallback to cache if XML parsing failed
            if feed_cache["data"] is not None:
                logger.warning("XML parsing failed, serving stale cache")
                return feed_cache["data"], False
            return None, False
            
    except Exception as e:
        logger.error(f"Error fetching feed: {e}")
        # Fallback to cache if network call failed
        if feed_cache["data"] is not None:
            logger.warning("Fetch failed, serving stale cache")
            return feed_cache["data"], False
        return None, False

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/releases")
def get_releases():
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    releases, was_refreshed = fetch_feed(force_refresh=force_refresh)
    
    if releases is None:
        return jsonify({"error": "Failed to retrieve release notes"}), 500
        
    return jsonify({
        "releases": releases,
        "last_fetched": feed_cache["last_fetched"].isoformat() if feed_cache["last_fetched"] else None,
        "refreshed": was_refreshed
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)
