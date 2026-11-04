const fs = require('fs');

// Simple DOM environment simulation
const html = fs.readFileSync('index.html', 'utf8');

// Global mock localStorage
const localStorageData = {};
global.localStorage = {
  getItem: (key) => localStorageData[key] || null,
  setItem: (key, val) => { localStorageData[key] = String(val); },
  removeItem: (key) => { delete localStorageData[key]; },
  clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); }
};

// Global mock window and document
class MockElement {
  constructor(tagName, id = '', className = '') {
    this.tagName = tagName;
    this.id = id;
    this.className = className;
    this.classList = {
      _classes: new Set(className ? className.split(' ') : []),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      contains: (c) => this.classList._classes.has(c),
      toggle: (c) => {
        if (this.classList._classes.has(c)) this.classList._classes.delete(c);
        else this.classList._classes.add(c);
      }
    };
    this.style = {};
    this.attributes = {};
    this.children = [];
    this._innerHTML = '';
    this.value = '';
    this.textContent = '';
  }
  reset() {}
  getAttribute(name) { return this.attributes[name] || null; }
  setAttribute(name, val) { this.attributes[name] = val; }
  addEventListener(event, fn) {}
  querySelector(sel) { return null; }
  querySelectorAll(sel) { return []; }
  set innerHTML(val) {
    this._innerHTML = val;
    this.textContent = val.replace(/<[^>]*>/g, '');
  }
  get innerHTML() { return this._innerHTML; }
}

const elementsById = new Map();

// Parse all IDs from index.html
const idMatches = html.matchAll(/id=["']([^"']+)["']/g);
for (const m of idMatches) {
  elementsById.set(m[1], new MockElement('div', m[1]));
}

global.document = {
  getElementById: (id) => {
    if (!elementsById.has(id)) {
      elementsById.set(id, new MockElement('div', id));
    }
    return elementsById.get(id);
  },
  querySelectorAll: (selector) => {
    if (selector === '.page-view') {
      const views = [];
      for (const [id, el] of elementsById) {
        if (id.startsWith('view-')) views.push(el);
      }
      return views;
    }
    if (selector === '.nav-item') {
      return [
        Object.assign(new MockElement('li'), { attributes: { 'data-target': 'landing' } }),
        Object.assign(new MockElement('li'), { attributes: { 'data-target': 'find-stations' } }),
        Object.assign(new MockElement('li'), { attributes: { 'data-target': 'list-charger' } }),
        Object.assign(new MockElement('li'), { attributes: { 'data-target': 'my-bookings' } }),
        Object.assign(new MockElement('li'), { attributes: { 'data-target': 'dashboard' } }),
      ];
    }
    if (selector === '.filter-tab-btn') {
      return [
        new MockElement('button'),
        new MockElement('button'),
        new MockElement('button'),
        new MockElement('button')
      ];
    }
    return [];
  },
  querySelector: (selector) => null,
  addEventListener: (event, fn) => {
    if (event === 'DOMContentLoaded') {
      setTimeout(fn, 10);
    }
  }
};

global.window = {
  location: { hash: '' },
  addEventListener: () => {},
  scrollTo: () => {}
};

const vm = require('vm');
// Load scripts in global context
vm.runInThisContext(fs.readFileSync('js/data.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('js/calculator.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('js/app.js', 'utf8'));

console.log("=== Testing Core App Logic ===");

// Test 1: Storage init
initStorage();
console.log("✓ Stations loaded:", AppState.stations.length);
console.log("✓ Bookings loaded:", AppState.bookings.length);
console.log("✓ User loaded:", AppState.currentUser.name);

// Test 2: Calculator module
const energy = EVCalculator.calculateEnergyRequired(40.5, 20, 80);
const cost = EVCalculator.calculateTotalCost(energy, 15.5);
const time = EVCalculator.estimateChargingTime(energy, 60);
console.log(`✓ Calculator: 20% to 80% on 40.5 kWh battery = ${energy} kWh, ₹${cost}, ${time.formatted}`);
if (energy !== 24.3) throw new Error("Calculator error on energy!");

// Test 3: Views
const views = ["landing", "dashboard", "find-stations", "my-bookings", "list-charger", "auth"];
for (const v of views) {
  AppState.activeView = v;
  renderCurrentView();
  console.log(`✓ View '${v}' rendered cleanly`);
}

// Test 4: Station Details View
AppState.selectedStationId = "st-101";
AppState.activeView = "station-details";
renderCurrentView();
console.log("✓ View 'station-details' rendered for st-101");

// Test 5: Booking Page View
AppState.selectedStationId = "st-101";
AppState.activeView = "book";
renderCurrentView();
console.log("✓ View 'book' rendered for st-101");

// Test 6: Filters
document.getElementById("filter-search-input").value = "Bengaluru";
const filteredBengaluru = getFilteredStations();
console.log(`✓ Filter by 'Bengaluru' returned ${filteredBengaluru.length} stations`);
if (filteredBengaluru.length === 0) throw new Error("Filter returned 0 stations for Bengaluru!");

console.log("\nALL LOGIC TESTS PASSED SUCCESSFULLY! 🎉");
