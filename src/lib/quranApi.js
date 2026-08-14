/**
 * Page fetching with a two-level cache (in-memory + localStorage).
 * Exactly one network request per newly visited page; revisits are free.
 */

const memCache = new Map();
const LS_PREFIX = 'qtsr.pagecache.';

function readLocalStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage full or unavailable — memory cache still works
  }
}

async function fetchPrimary(pageNumber) {
  const res = await fetch(
    `https://api.quran.com/api/v4/quran/verses/uthmani?page_number=${pageNumber}`,
  );
  if (!res.ok) throw new Error(`quran.com API ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.verses) || data.verses.length === 0) {
    throw new Error('quran.com API returned no verses');
  }
  return data.verses.map((v) => ({ key: v.verse_key, text: v.text_uthmani }));
}

async function fetchFallback(pageNumber) {
  const res = await fetch(`https://api.alquran.cloud/v1/page/${pageNumber}/quran-uthmani`);
  if (!res.ok) throw new Error(`alquran.cloud API ${res.status}`);
  const data = await res.json();
  const ayahs = data?.data?.ayahs;
  if (!Array.isArray(ayahs) || ayahs.length === 0) {
    throw new Error('alquran.cloud API returned no ayahs');
  }
  return ayahs.map((a) => ({
    key: `${a.surah.number}:${a.numberInSurah}`,
    text: a.text,
  }));
}

/**
 * @param {number} pageNumber 1–604
 * @returns {Promise<{page:number, verses:{key:string, text:string}[]}>}
 */
export async function fetchPage(pageNumber) {
  if (memCache.has(pageNumber)) return memCache.get(pageNumber);

  const lsKey = LS_PREFIX + pageNumber;
  const stored = readLocalStorage(lsKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.verses) && parsed.verses.length > 0) {
        memCache.set(pageNumber, parsed);
        return parsed;
      }
    } catch {
      // fall through to network
    }
  }

  let verses;
  try {
    verses = await fetchPrimary(pageNumber);
  } catch {
    verses = await fetchFallback(pageNumber);
  }
  const result = { page: pageNumber, verses };
  memCache.set(pageNumber, result);
  writeLocalStorage(lsKey, JSON.stringify(result));
  return result;
}
