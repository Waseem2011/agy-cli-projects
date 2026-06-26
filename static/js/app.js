// Global State
let releaseNotes = [];
let activeFilter = 'all';
let searchQuery = '';
let selectedUpdate = null;
let selectedDate = '';
let selectedLink = '';

// Progress Circle Circumference (r=10)
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * 10;

// DOM Elements
const body = document.body;
const themeToggle = document.getElementById('themeToggle');
const refreshBtn = document.getElementById('refreshBtn');
const refreshText = refreshBtn.querySelector('.refresh-text');
const refreshIcon = refreshBtn.querySelector('.icon-refresh');
const refreshSpinner = refreshBtn.querySelector('.spinner');

const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const filterChips = document.querySelectorAll('.chip');

const feedContent = document.getElementById('feedContent');
const feedLoading = document.getElementById('feedLoading');
const feedError = document.getElementById('feedError');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');
const feedEmpty = document.getElementById('feedEmpty');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

const statFeatures = document.getElementById('statFeatures');
const statChanges = document.getElementById('statChanges');
const statDeprecations = document.getElementById('statDeprecations');
const statSyncTime = document.getElementById('statSyncTime');
const feedMetaText = document.getElementById('feedMetaText');

// Tweet Modal Elements
const tweetModal = document.getElementById('tweetModal');
const closeModal = document.getElementById('closeModal');
const cancelTweet = document.getElementById('cancelTweet');
const previewBadge = document.getElementById('previewBadge');
const previewDate = document.getElementById('previewDate');
const previewText = document.getElementById('previewText');
const tweetTextArea = document.getElementById('tweetTextArea');
const charCount = document.getElementById('charCount');
const charProgress = document.getElementById('charProgress');
const publishTweetBtn = document.getElementById('publishTweetBtn');
const templateBtns = document.querySelectorAll('.btn-template');

// Initialize Progress Ring
if (charProgress) {
    charProgress.style.strokeDasharray = `${PROGRESS_CIRCUMFERENCE} ${PROGRESS_CIRCUMFERENCE}`;
    charProgress.style.strokeDashoffset = PROGRESS_CIRCUMFERENCE;
}

// ----------------------------------------------------
// Theme Logic
// ----------------------------------------------------
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
    } else {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme');
    }
}

themeToggle.addEventListener('click', () => {
    if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
    } else {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
    }
});

// ----------------------------------------------------
// Data Fetching Logic
// ----------------------------------------------------
async function fetchReleases(forceRefresh = false) {
    showLoading();
    try {
        const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        releaseNotes = result.releases;
        
        // Update stats and metadata
        updateStats(result.last_fetched);
        
        // Render timeline
        renderTimeline();
    } catch (err) {
        console.error('Error fetching release notes:', err);
        showError(err.message);
    }
}

function showLoading() {
    feedContent.classList.add('hidden');
    feedError.classList.add('hidden');
    feedEmpty.classList.add('hidden');
    feedLoading.classList.remove('hidden');
    
    // Animate header refresh button if clicked
    refreshIcon.classList.add('hidden');
    refreshSpinner.classList.remove('hidden');
    refreshBtn.disabled = true;
    refreshText.textContent = 'Syncing...';
}

function stopLoadingAnimation() {
    refreshIcon.classList.remove('hidden');
    refreshSpinner.classList.add('hidden');
    refreshBtn.disabled = false;
    refreshText.textContent = 'Refresh Data';
    feedLoading.classList.add('hidden');
}

function showError(msg) {
    stopLoadingAnimation();
    errorMessage.textContent = msg || 'We encountered an error syncing with the BigQuery feed. Please try again.';
    feedError.classList.remove('hidden');
}

// ----------------------------------------------------
// UI Render & Filter Logic
// ----------------------------------------------------
function updateStats(lastFetchedStr) {
    let featuresCount = 0;
    let changesCount = 0;
    let deprecationsCount = 0;
    
    releaseNotes.forEach(entry => {
        entry.updates.forEach(update => {
            const typeLower = update.type.toLowerCase();
            if (typeLower.includes('feature')) featuresCount++;
            else if (typeLower.includes('change')) changesCount++;
            else if (typeLower.includes('deprecat')) deprecationsCount++;
        });
    });
    
    // Update Stats DOM with counting animation
    animateValue(statFeatures, featuresCount);
    animateValue(statChanges, changesCount);
    animateValue(statDeprecations, deprecationsCount);
    
    // Format timestamp
    if (lastFetchedStr) {
        const d = new Date(lastFetchedStr);
        statSyncTime.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')';
        statSyncTime.title = d.toString();
    }
    
    // Remove skeleton class
    document.querySelectorAll('.stat-card').forEach(card => {
        card.classList.remove('loading-skeleton');
    });
}

function animateValue(obj, end, duration = 800) {
    let start = 0;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function renderTimeline() {
    stopLoadingAnimation();
    feedContent.innerHTML = '';
    
    // Filter the items
    const filteredEntries = [];
    let matchedUpdatesCount = 0;
    
    releaseNotes.forEach(entry => {
        const filteredUpdates = entry.updates.filter(update => {
            // Filter 1: Chip category
            if (activeFilter !== 'all') {
                const typeLower = update.type.toLowerCase();
                if (activeFilter === 'feature' && !typeLower.includes('feature')) return false;
                if (activeFilter === 'change' && !typeLower.includes('change')) return false;
                if (activeFilter === 'deprecation' && !typeLower.includes('deprecat')) return false;
            }
            
            // Filter 2: Search term query
            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                const matchesType = update.type.toLowerCase().includes(query);
                const matchesText = update.text.toLowerCase().includes(query);
                const matchesDate = entry.title.toLowerCase().includes(query);
                if (!matchesType && !matchesText && !matchesDate) return false;
            }
            
            return true;
        });
        
        if (filteredUpdates.length > 0) {
            filteredEntries.push({
                ...entry,
                updates: filteredUpdates
            });
            matchedUpdatesCount += filteredUpdates.length;
        }
    });
    
    // Render Empty State if no entries
    if (filteredEntries.length === 0) {
        feedContent.classList.add('hidden');
        feedEmpty.classList.remove('hidden');
        feedMetaText.textContent = `Showing 0 updates`;
        return;
    }
    
    feedEmpty.classList.add('hidden');
    feedContent.classList.remove('hidden');
    feedMetaText.textContent = `Showing ${matchedUpdatesCount} update${matchedUpdatesCount === 1 ? '' : 's'}`;
    
    // Build Timeline
    filteredEntries.forEach(entry => {
        const timelineGroup = document.createElement('div');
        timelineGroup.className = 'timeline-group';
        
        // Group Date Header
        const header = document.createElement('div');
        header.className = 'timeline-date-header';
        
        const dot = document.createElement('div');
        dot.className = 'timeline-dot';
        
        const dateText = document.createElement('span');
        dateText.className = 'timeline-date-text';
        dateText.textContent = entry.title;
        
        const link = document.createElement('a');
        link.className = 'timeline-date-link';
        link.href = entry.link;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.title = 'View official documentation for this date';
        link.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 4px;">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
        `;
        
        header.appendChild(dot);
        header.appendChild(dateText);
        header.appendChild(link);
        timelineGroup.appendChild(header);
        
        // Group Cards Container
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'timeline-cards';
        
        entry.updates.forEach(update => {
            const card = document.createElement('div');
            // Determine type class
            let typeClass = 'type-other';
            let badgeClass = 'badge-update';
            const typeLower = update.type.toLowerCase();
            
            if (typeLower.includes('feature')) {
                typeClass = 'type-feature';
                badgeClass = 'badge-feature';
            } else if (typeLower.includes('change')) {
                typeClass = 'type-change';
                badgeClass = 'badge-change';
            } else if (typeLower.includes('deprecat')) {
                typeClass = 'type-deprecation';
                badgeClass = 'badge-deprecation';
            }
            
            card.className = `release-card glass ${typeClass}`;
            
            card.innerHTML = `
                <div class="card-header">
                    <span class="type-badge ${badgeClass}">${update.type}</span>
                    <button class="btn-share" data-id="${update.id}">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                        </svg>
                        <span>Tweet</span>
                    </button>
                </div>
                <div class="card-body">
                    ${update.html}
                </div>
            `;
            
            // Add click listener to the share button
            const shareBtn = card.querySelector('.btn-share');
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openShareComposer(update, entry.title, entry.link);
            });
            
            cardsContainer.appendChild(card);
        });
        
        timelineGroup.appendChild(cardsContainer);
        feedContent.appendChild(timelineGroup);
    });
}

// ----------------------------------------------------
// Twitter Sharing & Composer Modal Logic
// ----------------------------------------------------
function openShareComposer(update, date, link) {
    selectedUpdate = update;
    selectedDate = date;
    selectedLink = link;
    
    // Set preview details
    previewDate.textContent = date;
    previewBadge.textContent = update.type;
    
    // Reset Badge classes
    previewBadge.className = 'type-badge';
    const typeLower = update.type.toLowerCase();
    if (typeLower.includes('feature')) previewBadge.classList.add('badge-feature');
    else if (typeLower.includes('change')) previewBadge.classList.add('badge-change');
    else if (typeLower.includes('deprecat')) previewBadge.classList.add('badge-deprecation');
    else previewBadge.classList.add('badge-update');
    
    previewText.textContent = update.text;
    
    // Select default template
    applyTweetTemplate('default');
    
    // Show Modal
    tweetModal.classList.remove('hidden');
    body.style.overflow = 'hidden'; // Lock background scroll
    tweetTextArea.focus();
}

function closeShareComposer() {
    tweetModal.classList.add('hidden');
    body.style.overflow = ''; // Unlock scroll
    selectedUpdate = null;
}

// Close listeners
closeModal.addEventListener('click', closeShareComposer);
cancelTweet.addEventListener('click', closeShareComposer);
tweetModal.addEventListener('click', (e) => {
    if (e.target === tweetModal) {
        closeShareComposer();
    }
});

// ESC Key closes modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !tweetModal.classList.contains('hidden')) {
        closeShareComposer();
    }
});

// Template application
function applyTweetTemplate(templateType) {
    if (!selectedUpdate) return;
    
    const type = selectedUpdate.type;
    const date = selectedDate;
    const text = selectedUpdate.text;
    
    // Shorten text description if too long
    // Standard link is counted as 23 characters on Twitter, so we leave space
    const maxTextLen = 160; 
    let shortText = text;
    if (shortText.length > maxTextLen) {
        shortText = shortText.slice(0, maxTextLen) + '...';
    }
    
    let tweetContent = '';
    
    switch (templateType) {
        case 'tech':
            tweetContent = `💻 BigQuery [${type}] (${date}):\n\n"${shortText}"\n\nRead details:\n${selectedLink} #GoogleCloud #BigQuery`;
            break;
            
        case 'concise':
            tweetContent = `⚡ BigQuery ${type}:\n${shortText}\n\nNotes: ${selectedLink} #GCP`;
            break;
            
        case 'default':
        default:
            tweetContent = `📢 New BigQuery Update (${date}):\n\n[${type}] ${shortText}\n\nView release notes:\n${selectedLink} #GoogleCloud`;
            break;
    }
    
    tweetTextArea.value = tweetContent;
    updateCharacterCount();
    
    // Highlight active template button
    templateBtns.forEach(btn => {
        if (btn.dataset.template === templateType) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function updateCharacterCount() {
    const text = tweetTextArea.value;
    
    // Twitter counts URL as 23 characters. We can calculate simple URL parsing,
    // but a standard estimate works beautifully.
    // Replace all URLs in text with a 23-char placeholder for Twitter counting
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex) || [];
    let textLengthForCounting = text.replace(urlRegex, '').length;
    textLengthForCounting += (urls.length * 23);
    
    const remaining = 280 - textLengthForCounting;
    charCount.textContent = remaining;
    
    // Calculate progress percent
    const percent = Math.min((textLengthForCounting / 280) * 100, 100);
    
    // Update progress ring offset
    const offset = PROGRESS_CIRCUMFERENCE - (percent / 100) * PROGRESS_CIRCUMFERENCE;
    charProgress.style.strokeDashoffset = offset;
    
    // Class coloring based on remaining length
    charCount.className = '';
    if (remaining < 0) {
        charCount.classList.add('text-danger');
        charProgress.style.stroke = 'var(--accent-deprecation)';
        publishTweetBtn.classList.add('disabled');
        publishTweetBtn.style.pointerEvents = 'none';
        publishTweetBtn.style.opacity = '0.5';
    } else if (remaining < 20) {
        charCount.classList.add('text-warning');
        charProgress.style.stroke = 'var(--accent-change)';
        publishTweetBtn.classList.remove('disabled');
        publishTweetBtn.style.pointerEvents = '';
        publishTweetBtn.style.opacity = '';
    } else {
        charProgress.style.stroke = 'var(--primary)';
        publishTweetBtn.classList.remove('disabled');
        publishTweetBtn.style.pointerEvents = '';
        publishTweetBtn.style.opacity = '';
    }
    
    if (textLengthForCounting === 0) {
        publishTweetBtn.classList.add('disabled');
        publishTweetBtn.style.pointerEvents = 'none';
        publishTweetBtn.style.opacity = '0.5';
    }
    
    // Update Share Link
    const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    publishTweetBtn.href = tweetUrl;
}

// TextArea Event Listeners
tweetTextArea.addEventListener('input', updateCharacterCount);

// Template Button Listeners
templateBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        applyTweetTemplate(btn.dataset.template);
    });
});

// Click Post opens X intent, then closes modal
publishTweetBtn.addEventListener('click', () => {
    setTimeout(() => {
        closeShareComposer();
    }, 1500);
});

// ----------------------------------------------------
// Filter & Search Input Handlers
// ----------------------------------------------------
filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeFilter = chip.dataset.filter;
        renderTimeline();
    });
});

searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    
    // Toggle clear search button
    if (searchQuery.trim() !== '') {
        clearSearchBtn.classList.remove('hidden');
    } else {
        clearSearchBtn.classList.add('hidden');
    }
    
    renderTimeline();
});

clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    renderTimeline();
    searchInput.focus();
});

// Reset Search & Filters button inside Empty state
resetFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    
    filterChips.forEach(c => c.classList.remove('active'));
    filterChips[0].classList.add('active'); // Set 'All' chip active
    activeFilter = 'all';
    
    renderTimeline();
});

// Retry Button on error
retryBtn.addEventListener('click', () => {
    fetchReleases(true);
});

// Refresh button on header
refreshBtn.addEventListener('click', () => {
    fetchReleases(true);
});

// ----------------------------------------------------
// Page Load Initialization
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchReleases();
});
