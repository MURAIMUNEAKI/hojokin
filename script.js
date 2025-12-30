document.addEventListener('DOMContentLoaded', () => {
  const bannerContainer = document.getElementById('banner-container');
  const bannerImage = document.getElementById('banner-image');
  const appContainer = document.getElementById('app-container');

  // URL to embed
  const BASE_URL = 'https://masaru.tech/hojokin/';

  bannerImage.addEventListener('click', () => {
    // 1. Fade out the banner
    bannerContainer.classList.add('hidden');

    // 2. Wait for transition to finish then remove/hide completely (optional, but good for cleanup)
    setTimeout(() => {
      bannerContainer.style.display = 'none';
    }, 500); // Matches CSS transition speed

    // 3. Load the iframe with cache busting
    loadIframe();
  });

  function loadIframe() {
    const iframe = document.createElement('iframe');
    
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    const url = `${BASE_URL}?t=${timestamp}`;
    
    iframe.src = url;
    iframe.title = "補助金検索ツール";
    iframe.allow = "fullscreen"; // Allow fullscreen if needed
    
    appContainer.innerHTML = ''; // Clear any existing content
    appContainer.appendChild(iframe);
  }
});
