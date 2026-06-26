# BigQuery Release Pulse

A premium, modern dashboard web application designed to track, search, filter, and share Google Cloud BigQuery release notes. Built using Python Flask for the backend, and plain vanilla HTML, CSS, and JavaScript for the frontend.

## Features

- **Live XML Feed Integration**: Retrieves release notes directly from the official Google Cloud feed: `https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`.
- **Intelligent HTML Parsing**: Automatically splits feed updates into individual type-specific cards (e.g., *Feature*, *Change*, *Deprecation*) rather than displaying large multi-topic date entries.
- **Smart Caching Layer**: Caches parsed results in memory for 30 minutes to reduce network requests, while allowing instant, manual feed refreshes using the **Refresh Data** button.
- **Modern UI/UX Dashboard**:
  - Glassmorphic interface with vibrant colors and neon glow accents.
  - Interactive counting animations for Feature, Change, and Deprecation stats.
  - Ambient glowing background elements that adapt to light and dark modes.
  - Fully responsive grid layout optimized for mobile, tablet, and desktop screens.
  - Search and filter bar for instant, client-side keyword matching and categorization.
  - Visual loading skeletons, rotating sync spinners, and custom modern scrollbars.
- **Interactive Twitter/X Share Integration**:
  - Click the **Tweet** button on any specific release card to open a custom composer modal.
  - **Character Limit Tracker**: Pre-calculates character usage including Twitter's standard 23-character URL allocation with a circular progress ring and warnings.
  - **Dynamic Tweet Templates**: Choose between *Update* (default), *Technical*, and *Concise* styles.
  - Customizable text area supporting direct modification before publishing via Twitter Web Intent.

---

## File Structure

```text
C:\Users\mehbo\agy-cli-projects/
├── app.py                # Python Flask server, caching logic & feed parser
├── requirements.txt      # Python dependencies (Flask, requests)
├── run.bat               # Windows batch script to launch the server
├── README.md             # Project documentation (this file)
├── templates/
│   └── index.html        # Main HTML page & structures (Composer modal)
└── static/
    ├── css/
    │   └── style.css     # Glassmorphic themes (dark/light), typography, animations
    └── js/
        └── app.js        # Ajax requests, search/filter logic, character progress
```

---

## Installation & Setup

Ensure you have **Python** (version 3.10+) installed on your machine.

1. **Clone/Open the Workspace**:
   Navigate to the directory `C:\Users\mehbo\agy-cli-projects`.

2. **Initialize Environment & Dependencies**:
   Open a terminal and run the following commands to set up the Python virtual environment and install requirements:
   ```bash
   # Create a virtual environment
   python -m venv .venv
   
   # Activate virtual environment
   # On Windows (cmd):
   .venv\Scripts\activate.bat
   # On Windows (PowerShell):
   .venv\Scripts\Activate.ps1
   
   # Install dependencies
   pip install -r requirements.txt
   ```
   *(Note: The setup was pre-configured using `uv`, which is faster and handles package management natively).*

3. **Start the Web App**:
   Simply run the launcher script:
   - Double-click [run.bat](file:///C:/Users/mehbo/agy-cli-projects/run.bat) in your file explorer.
   - Or run it via command prompt:
     ```cmd
     run.bat
     ```

4. **Access the Dashboard**:
   Open your browser and navigate to:
   ```text
   http://127.0.0.1:5000/
   ```

---

## Development & Customizations

### Changing Cache Expiry
You can adjust how frequently the backend queries the Google Cloud servers. In [app.py](file:///C:/Users/mehbo/agy-cli-projects/app.py#L21), modify the caching time in seconds:
```python
CACHE_EXPIRY_SECONDS = 1800  # Default 30 minutes
```

### Adding New Custom Tweet Templates
To modify or add tweet styles, open [static/js/app.js](file:///C:/Users/mehbo/agy-cli-projects/static/js/app.js#L363) and update the templates cases:
```javascript
switch (templateType) {
    case 'new_template':
        tweetContent = `🚀 Custom message about ${type}...`;
        break;
}
```
Add a corresponding button inside the modal template list in [templates/index.html](file:///C:/Users/mehbo/agy-cli-projects/templates/index.html#L215).
