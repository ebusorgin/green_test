class Storage {
    constructor() {
    }

    setItem(key, value) {
        if (typeof value === "object") {
            localStorage.setItem(key, JSON.stringify(value));
        } else {
            console.warn("Value should be an object!");
        }
    }

    getItem(key) {
        const retrievedData = localStorage.getItem(key);
        try {
            return retrievedData ? JSON.parse(retrievedData) : null;
        } catch (e) {
            console.error("Error parsing JSON from localStorage:", e);
            return null;
        }
    }

    removeItem(key) {
        localStorage.removeItem(key);
        console.log(`Данные с ключом '${key}' удалены из localStorage.`);
    }

    clearAll() {
        localStorage.clear();
        console.log("Все данные удалены из localStorage.");
    }

    get allItems() {
        const allData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = this.getItem(key); // Используем метод getItem
            allData[key] = value;
        }
        return allData;
    }

    set allItems(items) {
        if (typeof items === "object" && !Array.isArray(items)) {
            for (const [key, value] of Object.entries(items)) {
                this.setItem(key, value);
            }
        } else {
            console.warn("Items should be an object with key-value pairs.");
        }
    }
}