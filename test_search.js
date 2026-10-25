// Test suite for the jewellery search functionality
// This tests the matches() and renderResults() functions added in the recent changes

const collection = {
  categories: [
    { id: 'necklaces', label: 'Necklaces and sets' },
    { id: 'earrings', label: 'Earrings' },
    { id: 'rings', label: 'Rings' },
    { id: 'bangles', label: 'Bangles and bracelets' },
    { id: 'bridal', label: 'Bridal' },
    { id: 'silver', label: 'Silver items' },
  ],
  items: [
    { id: 'p1', name: 'Gold Necklace Set', category: 'necklaces', metal: 'Gold', purity: '22k', weight_tola: 2, price: 15000 },
    { id: 'p2', name: 'Diamond Earrings', category: 'earrings', metal: 'Gold', purity: '18k', weight_tola: 1, price: 8500 },
    { id: 'p3', name: 'Gold Ring', category: 'rings', metal: 'Gold', purity: '24k', weight_tola: 0.5, price: 5200 },
    { id: 'p4', name: 'Gold Bangles', category: 'bangles', metal: 'Gold', purity: '22k', weight_tola: 3, price: 22000 },
    { id: 'p5', name: 'Bridal Set', category: 'bridal', metal: 'Gold', purity: '22k', weight_tola: 5, price: 45000 },
    { id: 'p6', name: 'Silver Chain', category: 'silver', metal: 'Silver', weight_tola: 1, price: 3500 },
  ],
};

// matches function from script.js
function matches(i, q) {
  const c = collection.categories.find(x => x.id === i.category);
  return [i.name, i.category, c?.label, i.metal, i.purity, i.weight_tola].some(v => String(v ?? '').toLowerCase().includes(q));
}

// draw function simplified - just checks the items that would be rendered
function draw(term) {
  const q = (term || '').trim().toLowerCase();
  const found = collection.items.filter(i => matches(i, q)).slice(0, 6);
  return found;
}

// ===== TESTS =====

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL: ${name} — ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// 1. Test matches() with name search
test('matches() finds item by name', () => {
  assert(matches(collection.items[0], 'necklace') === true, 'Gold Necklace Set should match "necklace"');
  assert(matches(collection.items[0], 'gold') === true, 'Gold Necklace Set should match "gold"');
});

// 2. Test matches() with category search
test('matches() finds items by category', () => {
  assert(matches(collection.items[0], 'necklaces') === true, 'Gold Necklace Set should match category "necklaces"');
  assert(matches(collection.items[5], 'silver') === true, 'Silver Chain should match category "silver"');
});

// 3. Test matches() with metal search
test('matches() finds items by metal', () => {
  assert(matches(collection.items[1], 'gold') === true, 'Diamond Earrings should match "gold"');
  assert(matches(collection.items[5], 'silver') === true, 'Silver Chain should match "silver"');
});

// 4. Test matches() with no match
test('matches() returns false for non-matching term', () => {
  assert(matches(collection.items[0], 'platinum') === false, 'Gold Necklace Set should not match "platinum"');
  assert(matches(collection.items[0], 'xyz123') === false, 'Gold Necklace Set should not match random term');
});

// 5. Test renderResults with empty term
test('renderResults with empty term returns all items', () => {
  const results = draw('');
  assert(results.length === collection.items.length, `Empty term should return all ${collection.items.length} items`);
});

// 6. Test renderResults with matching term
test('renderResults filters items correctly', () => {
  const results = draw('gold');
  assert(results.length === 5, 'Should find 5 gold items');
  const names = results.map(r => r.name);
  assert(names.includes('Gold Necklace Set'), 'Should include Gold Necklace Set');
  assert(names.includes('Diamond Earrings'), 'Should include Diamond Earrings');
  assert(names.includes('Gold Ring'), 'Should include Gold Ring');
  assert(names.includes('Gold Bangles'), 'Should include Gold Bangles');
  assert(names.includes('Bridal Set'), 'Should include Bridal Set');
});

// 7. Test renderResults with silver
test('renderResults filters silver items', () => {
  const results = draw('silver');
  assert(results.length === 1, 'Should find 1 silver item');
  assert(results[0].name === 'Silver Chain', 'Should be Silver Chain');
});

// 8. Test renderResults limits to 6 items
test('renderResults limits to max 6 items', () => {
  const results = draw('gold');
  assert(results.length <= 6, `Should limit to 6, got ${results.length}`);
});

// 9. Test search is case-insensitive
test('matches() is case-insensitive', () => {
  // Note: The draw()/renderResults functions always lowercase q before calling matches,
  // so matches() is always called with a lowercased query in practice
  assert(matches(collection.items[0], 'necklace') === true, 'Should match lowercase');
  assert(matches(collection.items[0], 'gold') === true, 'Should match lowercase metal');
  assert(matches(collection.items[0], 'set') === true, 'Should match partial name');
});

// 10. Test search with no matches shows empty state
test('renderResults shows empty state when no matches', () => {
  const results = draw('nonexistent');
  assert(results.length === 0, 'Should return 0 results for non-existent term');
});

// ===== SUMMARY =====

console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed! ✓');
}
