// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD2WZnOuDXBLXR7uAq_LTK46q7tr13Mqvw",
  authDomain: "gadendigitech.firebaseapp.com",
  projectId: "gadendigitech",
  storageBucket: "gadendigitech.appspot.com",
  messagingSenderId: "134032321432",
  appId: "1:134032321432:web:dedbb189a68980661259ed",
  measurementId: "G-VLG9G3FCP0"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Global variables
let currentCategory = 'All';
let currentSubcategory = null;
let editDocId = null;
let barcodeInputBuffer = '';
let barcodeTimeout;
const BARCODE_DELAY = 50;

// Phone subcategories
const PHONE_SUBCATEGORIES = [
  'iPhone', 'Samsung', 'Huawei',
  'Tecno', 'Infinix', 'Oppo',
  'Xiaomi'
];

// Initialize application
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = 'index.html';
    } else {
      setupUI();
      loadStock();
    }
  });
}

function setupUI() {
  // Category buttons
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentCategory = e.target.dataset.category || 'All';
      currentSubcategory = null;
      console.log(`Category changed to: ${currentCategory}`);
      loadStock();
      updateSubcategoryButtons();
    });
  });

  // Add Product Button
  document.getElementById('addProductBtn').addEventListener('click', showAddProductForm);

  // Form controls
  document.getElementById('cancelBtn').addEventListener('click', hideAddProductForm);
  document.getElementById('addProductForm').addEventListener('submit', handleFormSubmit);

  // Dynamic subcategory field
  document.getElementById('prodCategory').addEventListener('change', function() {
    const subcatField = document.getElementById('prodSubcategory');
    subcatField.style.display = this.value === 'Phones' ? 'block' : 'none';
  });

  // Barcode handling
  document.getElementById('prodBarcode').addEventListener('keydown', function(e) {
    clearTimeout(barcodeTimeout);
    
    if (e.key === 'Enter') {
      e.preventDefault();
      processScannedBarcode(barcodeInputBuffer.trim());
      barcodeInputBuffer = '';
      return;
    }
    
    if (e.key.length === 1) {
      barcodeInputBuffer += e.key;
      barcodeTimeout = setTimeout(() => barcodeInputBuffer = '', BARCODE_DELAY);
    }
  });
}

function updateSubcategoryButtons() {
  const container = document.querySelector('.subcategory-buttons');
  if (!container) return;
  
  container.innerHTML = '';

  if (currentCategory === 'Phones') {
    PHONE_SUBCATEGORIES.forEach(subcat => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline-secondary subcategory-btn';
      btn.textContent = subcat;
      btn.addEventListener('click', () => {
        currentSubcategory = subcat;
        console.log(`Subcategory selected: ${currentSubcategory}`);
        loadStock();
      });
      container.appendChild(btn);
    });
  }
}

async function loadStock() {
  const tbody = document.getElementById('stockTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';

  try {
    let query = db.collection('stockmgt');
    
    // Server-side filtering
    if (currentCategory !== 'All') {
      query = query.where('category', '==', currentCategory);
      
      if (currentCategory === 'Phones' && currentSubcategory) {
        query = query.where('subcategory', '==', currentSubcategory);
      }
    }

    const snapshot = await query.get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`Loaded ${products.length} products`);
    displayStockItems(products);
  } catch (error) {
    console.error("Error loading stock:", error);
    tbody.innerHTML = '<tr><td colspan="8">Error loading data</td></tr>';
  }
}

function displayStockItems(products) {
  const tbody = document.getElementById('stockTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (products.length === 0) {
    const message = currentSubcategory 
      ? `No ${currentSubcategory} phones found` 
      : currentCategory !== 'All' 
        ? `No products in ${currentCategory} category` 
        : 'No products found';
    tbody.innerHTML = `<tr><td colspan="8">${message}</td></tr>`;
    return;
  }

  products.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.barcode || ''}</td>
      <td>${item.itemName || ''}</td>
      <td>${item.category || ''}</td>
      <td>${item.subcategory || '-'}</td>
      <td>${item.description || '-'}</td>
      <td>${item.costPrice?.toFixed(2) || '0.00'}</td>
      <td>${item.sellingPrice?.toFixed(2) || '0.00'}</td>
      <td>${item.stockQty || 0}</td>
      <td><button class="btn btn-sm btn-primary edit-btn">Edit</button></td>
    `;
    tr.querySelector('.edit-btn').addEventListener('click', () => {
      populateFormForEdit(item.id, item);
    });
    tbody.appendChild(tr);
  });
}
function showAddProductForm() {
  resetForm();
  document.getElementById('formTitle').textContent = 'Add New Product';
  document.getElementById('formSubmitBtn').textContent = 'Add Product';
  
  // Initialize subcategory visibility
  const categorySelect = document.getElementById('prodCategory');
  const subcategoryField = document.getElementById('prodSubcategory');
  subcategoryField.style.display = categorySelect.value === 'Phones' ? 'block' : 'none';
  
  document.getElementById('addProductSection').style.display = 'block';
  document.getElementById('prodBarcode').focus();
}

function hideAddProductForm() {
  document.getElementById('addProductSection').style.display = 'none';
  resetForm();
}

function resetForm() {
  document.getElementById('addProductForm').reset();
  document.getElementById('prodSubcategory').style.display = 'none';
  document.getElementById('prodBarcode').disabled = false;
  editDocId = null;
}

function populateFormForEdit(docId, item) {
  editDocId = docId;
  document.getElementById('formTitle').textContent = 'Edit Product';
  document.getElementById('formSubmitBtn').textContent = 'Update Product';

  const form = document.getElementById('addProductForm');
  form.prodBarcode.value = item.barcode || '';
  form.prodBarcode.disabled = true;
  form.prodName.value = item.itemName || '';
  form.prodCategory.value = item.category || '';
  
  if (item.category === 'Phones') {
    form.prodSubcategory.style.display = 'block';
    form.prodSubcategory.value = item.subcategory || '';
  }
  
  form.prodDescription.value = item.description || '';
  form.prodCostPrice.value = item.costPrice || '';
  form.prodSellingPrice.value = item.sellingPrice || '';
  form.prodStockQty.value = item.stockQty || '';

  document.getElementById('addProductSection').style.display = 'block';
  form.prodName.focus();
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;

  const formData = {
    barcode: form.prodBarcode.value.trim(),
    itemName: form.prodName.value.trim(),
    category: form.prodCategory.value,
    subcategory: form.prodCategory.value === 'Phones' ? form.prodSubcategory.value : null,
    description: form.prodDescription.value.trim(),
    costPrice: parseFloat(form.prodCostPrice.value) || 0,
    sellingPrice: parseFloat(form.prodSellingPrice.value) || 0,
    stockQty: parseInt(form.prodStockQty.value) || 0,
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  };

  console.log('Form data:', formData); // Debug log

  if (!formData.barcode || !formData.itemName || !formData.category) {
    alert('Please fill required fields');
    return;
  }

  try {
    if (editDocId) {
      await db.collection('stockmgt').doc(editDocId).update(formData);
      alert('Product updated!');
    } else {
      // Check for duplicate barcode
      const snapshot = await db.collection('stockmgt')
        .where('barcode', '==', formData.barcode)
        .get();
      
      if (!snapshot.empty) {
        alert('Barcode already exists!');
        return;
      }
      
      await db.collection('stockmgt').add(formData);
      alert('Product added!');
    }
    
    hideAddProductForm();
    loadStock();
  } catch (error) {
    console.error("Error saving product:", error);
    alert("Error saving product");
  }
}

async function processScannedBarcode(barcode) {
  if (!barcode) return;
  
  try {
    const snapshot = await db.collection('stockmgt')
      .where('barcode', '==', barcode)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      populateFormForEdit(doc.id, doc.data());
    } else {
      showAddProductForm();
      document.getElementById('prodBarcode').value = barcode;
      document.getElementById('prodName').focus();
      playSound('info');
    }
  } catch (error) {
    console.error("Barcode error:", error);
    playSound('error');
  }
}

function playSound(type) {
  const audio = new Audio();
  audio.src = type === 'success' ? 
    'https://assets.mixkit.co/sfx/preview/mixkit-cash-register-purchase-2759.mp3' :
    type === 'info' ? 
    'https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3' :
    'https://assets.mixkit.co/sfx/preview/mixkit-warning-alarm-688.mp3';
  audio.play().catch(e => console.error("Audio error:", e));
}

// Load stock with filtering
async function loadStock() {
  const tbody = document.getElementById('stockTableBody');
  tbody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>';

  try {
    // First get ALL products
    const snapshot = await db.collection('stockmgt').get();
    let products = [];
    snapshot.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() });
    });

    // Then filter locally
    let filteredProducts = products;
    if (currentCategory !== 'All') {
      filteredProducts = products.filter(p => p.category === currentCategory);
      
      if (currentCategory === 'Phones' && currentSubcategory) {
        filteredProducts = filteredProducts.filter(p => p.subcategory === currentSubcategory);
      }
    }

    displayStockItems(filteredProducts);
  } catch (error) {
    console.error("Error loading stock:", error);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center error">
          Error loading data. Please try again.
        </td>
      </tr>
    `;
    playSound('error');
  }
}

// Display stock items in the table
function displayStockItems(products) {
  const tbody = document.getElementById('stockTableBody');
  tbody.innerHTML = '';

  if (products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center">
          No products found in ${currentSubcategory || currentCategory}
        </td>
      </tr>
    `;
    return;
  }

  products.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.barcode || ''}</td>
      <td>${item.itemName || ''}</td>
      <td>${item.category || ''}</td>
      <td>${item.subcategory || '-'}</td>
      <td>${item.description || '-'}</td>
      <td>${item.costPrice ? item.costPrice.toFixed(2) : '0.00'}</td>
      <td>${item.sellingPrice ? item.sellingPrice.toFixed(2) : '0.00'}</td>
      <td>${item.stockQty || 0}</td>
      <td class="actions">
        <button class="btn btn-sm btn-primary edit-btn">Edit</button>
      </td>
    `;
    
    tr.querySelector('.edit-btn').addEventListener('click', () => {
      populateFormForEdit(item.id, item);
    });
    
    tbody.appendChild(tr);
  });
}

// Show the add product form
function showAddProductForm() {
  resetForm();
  document.getElementById('formTitle').textContent = 'Add New Product';
  document.getElementById('formSubmitBtn').textContent = 'Add Product';
  document.getElementById('addProductSection').style.display = 'block';
  document.getElementById('prodBarcode').focus();
}

// Hide the add product form
function hideAddProductForm() {
  document.getElementById('addProductSection').style.display = 'none';
  resetForm();
}

// Reset the form to default state
function resetForm() {
  document.getElementById('addProductForm').reset();
  document.getElementById('prodSubcategory').style.display = 'none';
  editDocId = null;
}

// Populate form for editing an existing product
function populateFormForEdit(docId, item) {
  editDocId = docId;
  document.getElementById('formTitle').textContent = 'Edit Product';
  document.getElementById('formSubmitBtn').textContent = 'Update Product';

  // Fill form fields
  document.getElementById('prodBarcode').value = item.barcode || '';
  document.getElementById('prodBarcode').disabled = true;
  document.getElementById('prodName').value = item.itemName || '';
  document.getElementById('prodCategory').value = item.category || '';
  
  if (item.category === 'Phones') {
    document.getElementById('prodSubcategory').style.display = 'block';
    document.getElementById('prodSubcategory').value = item.subcategory || '';
  }
  
  document.getElementById('prodDescription').value = item.description || '';
  document.getElementById('prodCostPrice').value = item.costPrice || '';
  document.getElementById('prodSellingPrice').value = item.sellingPrice || '';
  document.getElementById('prodStockQty').value = item.stockQty || '';

  document.getElementById('addProductSection').style.display = 'block';
  document.getElementById('prodName').focus();
}

// Handle form submission
async function handleFormSubmit(e) {
  e.preventDefault();

  // Get form values
  const formData = {
    barcode: document.getElementById('prodBarcode').value.trim(),
    itemName: document.getElementById('prodName').value.trim(),
    category: document.getElementById('prodCategory').value,
    subcategory: document.getElementById('prodCategory').value === 'Phones' 
      ? document.getElementById('prodSubcategory').value 
      : null,
    description: document.getElementById('prodDescription').value.trim(),
    costPrice: parseFloat(document.getElementById('prodCostPrice').value) || 0,
    sellingPrice: parseFloat(document.getElementById('prodSellingPrice').value) || 0,
    stockQty: parseInt(document.getElementById('prodStockQty').value) || 0,
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  };

  // Basic validation
  if (!formData.barcode || !formData.itemName || !formData.category) {
    alert('Please fill in all required fields');
    playSound('error');
    return;
  }

  if (isNaN(formData.costPrice) || isNaN(formData.sellingPrice) || isNaN(formData.stockQty)) {
    alert('Please enter valid numbers for prices and quantity');
    playSound('error');
    return;
  }

  if (formData.costPrice <= 0 || formData.sellingPrice <= 0 || formData.stockQty < 0) {
    alert('Prices must be positive and stock cannot be negative');
    playSound('error');
    return;
  }

  try {
    if (editDocId) {
      // Update existing product
      await db.collection('stockmgt').doc(editDocId).update(formData);
      playSound('success');
      alert('Product updated successfully!');
    } else {
      // Check for duplicate barcode
      const existing = await db.collection('stockmgt')
                            .where('barcode', '==', formData.barcode)
                            .get();
      if (!existing.empty) {
        alert('A product with this barcode already exists!');
        playSound('error');
        return;
      }
      
      // Add new product
      await db.collection('stockmgt').add(formData);
      playSound('success');
      alert('Product added successfully!');
    }
    
    hideAddProductForm();
    loadStock();
  } catch (error) {
    console.error("Error saving product:", error);
    playSound('error');
    alert("Error saving product. Please check console for details.");
  }
}