// IndexedDB-based cache for storing request history with images and audio samples

export interface AudioSampleData {
  filename: string;
  description: string;
  audioBlob: Blob;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  imageBlob: Blob;
  imageThumbnail: string; // Base64 thumbnail for quick display
  samples: AudioSampleData[];
}

const DB_NAME = "art-to-audio-history";
const DB_VERSION = 1;
const STORE_NAME = "history";

class HistoryCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error("Failed to open IndexedDB"));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  private async ensureDb(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    return this.db;
  }

  async saveEntry(
    imageBase64: string,
    samples: { filename: string; description: string; audioUrl: string }[]
  ): Promise<string> {
    const db = await this.ensureDb();

    // Convert base64 image to blob
    const imageBlob = await this.base64ToBlob(imageBase64);

    // Create thumbnail (smaller version for quick display)
    const thumbnail = await this.createThumbnail(imageBase64);

    // Convert audio URLs to blobs
    const audioSamples: AudioSampleData[] = await Promise.all(
      samples.map(async (sample) => {
        const response = await fetch(sample.audioUrl);
        const audioBlob = await response.blob();
        return {
          filename: sample.filename,
          description: sample.description,
          audioBlob,
        };
      })
    );

    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      imageBlob,
      imageThumbnail: thumbnail,
      samples: audioSamples,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(entry);

      request.onsuccess = () => resolve(entry.id);
      request.onerror = () => reject(new Error("Failed to save entry"));
    });
  }

  async getAllEntries(): Promise<HistoryEntry[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("timestamp");
      const request = index.openCursor(null, "prev"); // Sort by timestamp descending

      const entries: HistoryEntry[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          entries.push(cursor.value);
          cursor.continue();
        } else {
          resolve(entries);
        }
      };

      request.onerror = () => reject(new Error("Failed to fetch entries"));
    });
  }

  async getEntry(id: string): Promise<HistoryEntry | null> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error("Failed to fetch entry"));
    });
  }

  async deleteEntry(id: string): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("Failed to delete entry"));
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("Failed to clear history"));
    });
  }

  private async base64ToBlob(base64: string): Promise<Blob> {
    // Handle both with and without data URL prefix
    const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
    const mimeMatch = base64.match(/data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/png";

    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  private async createThumbnail(base64: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 150;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => resolve(base64); // Fallback to original
      img.src = base64;
    });
  }

  // Convert stored entry to displayable format with Object URLs
  async entryToDisplayFormat(
    entry: HistoryEntry
  ): Promise<{
    id: string;
    timestamp: number;
    imageUrl: string;
    imageThumbnail: string;
    samples: { filename: string; description: string; audioUrl: string }[];
  }> {
    const imageUrl = URL.createObjectURL(entry.imageBlob);
    const samples = entry.samples.map((sample) => ({
      filename: sample.filename,
      description: sample.description,
      audioUrl: URL.createObjectURL(sample.audioBlob),
    }));

    return {
      id: entry.id,
      timestamp: entry.timestamp,
      imageUrl,
      imageThumbnail: entry.imageThumbnail,
      samples,
    };
  }
}

// Singleton instance
export const historyCache = new HistoryCache();
