// IndexedDB-based cache for storing request history with images and audio samples
// Supports JSON export/import for persistence across sessions

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

// Serializable format for JSON export
export interface SerializedAudioSample {
  filename: string;
  description: string;
  audioBase64: string;
  mimeType: string;
}

export interface SerializedHistoryEntry {
  id: string;
  timestamp: number;
  imageBase64: string;
  imageMimeType: string;
  imageThumbnail: string;
  samples: SerializedAudioSample[];
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

  // Convert a Blob to base64 string
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix to get pure base64
        const base64Data = base64.split(",")[1] || base64;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Serialize a single entry for JSON export
  private async serializeEntry(
    entry: HistoryEntry
  ): Promise<SerializedHistoryEntry> {
    const imageBase64 = await this.blobToBase64(entry.imageBlob);
    const samples: SerializedAudioSample[] = await Promise.all(
      entry.samples.map(async (sample) => ({
        filename: sample.filename,
        description: sample.description,
        audioBase64: await this.blobToBase64(sample.audioBlob),
        mimeType: sample.audioBlob.type || "audio/wav",
      }))
    );

    return {
      id: entry.id,
      timestamp: entry.timestamp,
      imageBase64,
      imageMimeType: entry.imageBlob.type || "image/png",
      imageThumbnail: entry.imageThumbnail,
      samples,
    };
  }

  // Deserialize a JSON entry back to HistoryEntry
  private deserializeEntry(serialized: SerializedHistoryEntry): HistoryEntry {
    const imageBlob = this.base64ToBlobSync(
      serialized.imageBase64,
      serialized.imageMimeType
    );
    const samples: AudioSampleData[] = serialized.samples.map((sample) => ({
      filename: sample.filename,
      description: sample.description,
      audioBlob: this.base64ToBlobSync(sample.audioBase64, sample.mimeType),
    }));

    return {
      id: serialized.id,
      timestamp: serialized.timestamp,
      imageBlob,
      imageThumbnail: serialized.imageThumbnail,
      samples,
    };
  }

  // Synchronous base64 to Blob conversion
  private base64ToBlobSync(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  // Export all history to JSON string
  async exportToJSON(): Promise<string> {
    const entries = await this.getAllEntries();
    const serialized = await Promise.all(
      entries.map((entry) => this.serializeEntry(entry))
    );
    return JSON.stringify(serialized, null, 2);
  }

  // Import history from JSON string (merges with existing)
  async importFromJSON(jsonString: string, replace = false): Promise<number> {
    const db = await this.ensureDb();
    const serialized: SerializedHistoryEntry[] = JSON.parse(jsonString);

    if (replace) {
      await this.clearAll();
    }

    let importedCount = 0;
    for (const item of serialized) {
      const entry = this.deserializeEntry(item);
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(entry); // Use put to update existing or insert new

        request.onsuccess = () => {
          importedCount++;
          resolve();
        };
        request.onerror = () => reject(new Error("Failed to import entry"));
      });
    }

    return importedCount;
  }

  // Save history to server (via API)
  async saveToServer(): Promise<void> {
    const json = await this.exportToJSON();
    const response = await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
    });
    if (!response.ok) {
      throw new Error("Failed to save history to server");
    }
  }

  // Load history from server (via API)
  async loadFromServer(replace = false): Promise<number> {
    const response = await fetch("/api/history");
    if (!response.ok) {
      if (response.status === 404) {
        return 0; // No history file exists yet
      }
      throw new Error("Failed to load history from server");
    }
    const json = await response.text();
    if (!json || json === "[]") {
      return 0;
    }
    return this.importFromJSON(json, replace);
  }

  // Auto-sync: save to server after each modification
  async saveEntryWithSync(
    imageBase64: string,
    samples: { filename: string; description: string; audioUrl: string }[]
  ): Promise<string> {
    const id = await this.saveEntry(imageBase64, samples);
    // Fire and forget server sync
    this.saveToServer().catch(console.error);
    return id;
  }

  async deleteEntryWithSync(id: string): Promise<void> {
    await this.deleteEntry(id);
    // Fire and forget server sync
    this.saveToServer().catch(console.error);
  }

  async clearAllWithSync(): Promise<void> {
    await this.clearAll();
    // Fire and forget server sync
    this.saveToServer().catch(console.error);
  }
}

// Singleton instance
export const historyCache = new HistoryCache();
