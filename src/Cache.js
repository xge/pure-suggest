export async function cachedFetch(url, processData) {
  if (localStorage[url]) {
    processData(JSON.parse(localStorage[url]));
  } else {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Received response with status ${response.status}`);
      }
      const data = await response.json();
      console.log(`Successfully fetched data for "${url}"`);
      addToCache(url, data);
      processData(data);
    } catch (error) {
      console.error(`Unable to fetch or process data for "${url}": ${error}`)
    }
  }
}

export async function preloadPublications(dois) {
  const filteredDois = dois.filter(doi => !localStorage[`https://opencitations.net/index/coci/api/v1/metadata/${doi}`])
  if (!filteredDois.length) {
    return;
  }
  console.log(`Preloading ${filteredDois.length} publications`)
  const url = `https://opencitations.net/index/coci/api/v1/metadata/${filteredDois.join("__")}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Received response with status ${response.status}`);
    }
    const data = await response.json();
    data.forEach(publicationData =>
      addToCache(`https://opencitations.net/index/coci/api/v1/metadata/${publicationData.doi}`, [publicationData])
    );
  } catch (error) {
    console.error(`Unable to preload publications with "${url}": ${error}`)
  }
}

export function clearCache() {
  localStorage.clear();
}

function addToCache(url, data) {
  try {
    localStorage[url] = JSON.stringify(data);
  } catch (error) {
    try {
      // local storage cache full, delete random elements
      for (let i = 0; i < 100; i++) {
        const randomStoredUrl = Object.keys(localStorage)[
          Math.floor(Math.random() * Object.keys(localStorage).length)
        ];
        localStorage.removeItem(randomStoredUrl);
      }
      localStorage[url] = JSON.stringify(data);
    } catch (error2) {
      console.error(
        `Unable to cache information for "${url}" in local storage: ${error2}`
      );
    }
  }
}