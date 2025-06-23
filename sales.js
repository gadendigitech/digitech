// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: "AIzaSyD2WZnOuDXBLXR7uAq_LTK46q7tr13Mqvw",
    authDomain: "gadendigitech.firebaseapp.com",
    projectId: "gadendigitech",
    storageBucket: "gadendigitech.firebasestorage.app",
    messagingSenderId: "134032321432",
    appId: "1:134032321432:web:dedbb189a68980661259ed",
    measurementId: "G-VLG9G3FCP0"
  });
}
const auth = firebase.auth();
const db = firebase.firestore();

// Global variables
let products = [];
let currentSaleItems = [];
let barcodeInputBuffer = '';
let barcodeTimeout;
const BARCODE_DELAY = 50; // Time between barcode characters (ms)

// Initialize the sales system
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location = 'index.html';
  } else {
    loadProducts();
    setupBarcodeScanner();
    setupSalesForm();
    loadSalesRecords();
    loadCreditSales();
    calculateProfit();
    document.getElementById('saleDate').valueAsDate = new Date(); // Set default date
    document.getElementById('saleBarcode').focus();
  }
});

// Load all products from Firestore
async function loadProducts() {
  try {
    const snapshot = await db.collection('stockmgt').get();
    products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`${products.length} products loaded`);
  } catch (error) {
    console.error("Error loading products:", error);
    alert("Error loading products. Check console for details.");
  }
}

// Setup USB barcode scanner handler
function setupBarcodeScanner() {
  const barcodeInput = document.getElementById('saleBarcode');
  
  barcodeInput.addEventListener('keydown', function(e) {
    clearTimeout(barcodeTimeout);
    
    if (e.key === 'Enter') {
      e.preventDefault();
      processScannedBarcode(barcodeInputBuffer.trim());
      barcodeInputBuffer = '';
      return;
    }
    
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      barcodeInputBuffer += e.key;
      barcodeTimeout = setTimeout(() => barcodeInputBuffer = '', BARCODE_DELAY);
    }
  });
}

// Process scanned barcode
async function processScannedBarcode(barcode) {
  if (!barcode) return;
  
  const product = products.find(p => p.barcode === barcode);
  const barcodeInput = document.getElementById('saleBarcode');
  
  if (product) {
    // Check if product already exists in current sale
    const existingItemIndex = currentSaleItems.findIndex(item => item.barcode === barcode);
    
    if (existingItemIndex >= 0) {
      // Increment quantity if already exists
      if (currentSaleItems[existingItemIndex].quantity < currentSaleItems[existingItemIndex].stockQty) {
        currentSaleItems[existingItemIndex].quantity++;
        currentSaleItems[existingItemIndex].total = 
          currentSaleItems[existingItemIndex].quantity * currentSaleItems[existingItemIndex].sellingPrice;
      } else {
        alert(`Only ${currentSaleItems[existingItemIndex].stockQty} available in stock!`);
      }
    } else {
      // Add new item if doesn't exist
      currentSaleItems.push({
        ...product,
        quantity: 1,
        total: product.sellingPrice
      });
    }
    
    // Update UI
    barcodeInput.value = '';
    updateSaleSummary();
    playSound('success');
    
    // Focus quantity field for the last added item
    const quantityInputs = document.querySelectorAll('.sale-item-quantity');
    if (quantityInputs.length > 0) {
      quantityInputs[quantityInputs.length - 1].focus();
      quantityInputs[quantityInputs.length - 1].select();
    }
  } else {
    barcodeInput.value = '';
    playSound('error');
    alert(`Product with barcode ${barcode} not found!`);
  }
}

// Update the sale summary display
function updateSaleSummary() {
  const summaryContainer = document.getElementById('saleItemsContainer');
  summaryContainer.innerHTML = '';
  
  currentSaleItems.forEach((item, index) => {
    const itemElement = document.createElement('div');
    itemElement.className = 'sale-item';
    itemElement.innerHTML = `
      <span>${item.itemName} (${item.barcode})</span>
      <input type="number" class="sale-item-quantity" value="${item.quantity}" 
             min="1" max="${item.stockQty}" data-index="${index}">
      <span>@ ${item.sellingPrice.toFixed(2)}</span>
      <span>= ${item.total.toFixed(2)}</span>
      <button class="remove-item" data-index="${index}">×</button>
    `;
    summaryContainer.appendChild(itemElement);
  });
  
  // Add event listeners for quantity changes
  document.querySelectorAll('.sale-item-quantity').forEach(input => {
    input.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      const newQuantity = parseInt(e.target.value);
      
      if (newQuantity > currentSaleItems[index].stockQty) {
        alert(`Only ${currentSaleItems[index].stockQty} available in stock!`);
        e.target.value = currentSaleItems[index].stockQty;
        return;
      }
      
      if (newQuantity < 1) {
        e.target.value = 1;
        return;
      }
      
      currentSaleItems[index].quantity = newQuantity;
      currentSaleItems[index].total = newQuantity * currentSaleItems[index].sellingPrice;
      updateSaleSummary();
    });
  });
  
  // Add event listeners for remove buttons
  document.querySelectorAll('.remove-item').forEach(button => {
    button.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      currentSaleItems.splice(index, 1);
      updateSaleSummary();
    });
  });
  
  // Update totals
  const subtotal = currentSaleItems.reduce((sum, item) => sum + item.total, 0);
  document.getElementById('saleTotal').value = subtotal.toFixed(2);
}

// Setup the sales form
function setupSalesForm() {
  document.getElementById('salesForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (currentSaleItems.length === 0) {
      alert('Please scan at least one item!');
      return;
    }
    
    const date = document.getElementById('saleDate').value;
    const clientName = document.getElementById('clientName').value.trim();
    const clientPhone = document.getElementById('clientPhone').value.trim();
    const saleType = document.getElementById('saleType').value;
    
    if (!date || !clientName) {
      alert('Please fill all required fields!');
      return;
    }
    
    try {
      // Process each sale item
      const batch = db.batch();
      const salesRef = db.collection('sales');
      const stockRef = db.collection('stockmgt');
      
      // Create sale records and update stock
      currentSaleItems.forEach(item => {
        // Add sale record
        const newSaleRef = salesRef.doc();
        batch.set(newSaleRef, {
          date,
          clientName,
          clientPhone,
          barcode: item.barcode,
          itemName: item.itemName,
          quantity: item.quantity,
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice,
          totalCost: item.costPrice * item.quantity,
          totalSale: item.total,
          saleType,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update stock
        const itemRef = stockRef.doc(item.id);
        batch.update(itemRef, {
          stockQty: firebase.firestore.FieldValue.increment(-item.quantity)
        });
      });
      
      // Commit the batch
      await batch.commit();
      
      // Generate receipt
      generateReceipt({
        id: new Date().getTime().toString(),
        date,
        clientName,
        clientPhone,
        items: currentSaleItems,
        saleType
      });
      
      // Reset form
      currentSaleItems = [];
      updateSaleSummary();
      document.getElementById('salesForm').reset();
      document.getElementById('saleDate').valueAsDate = new Date();
      document.getElementById('saleBarcode').focus();
      
      // Refresh data
      loadProducts();
      loadSalesRecords();
      calculateProfit();
      
      alert('Sale completed successfully!');
      playSound('success');
    } catch (error) {
      console.error('Error processing sale:', error);
      alert('Error processing sale. Check console for details.');
      playSound('error');
    }
  });
}

// Play sound feedback
function playSound(type) {
  const audio = new Audio();
  audio.src = type === 'success' ? 
    'https://assets.mixkit.co/sfx/preview/mixkit-cash-register-purchase-2759.mp3' :
    'https://assets.mixkit.co/sfx/preview/mixkit-warning-alarm-688.mp3';
  audio.play();
}

// --- Sales Records Table with Date Filter and Print Receipt ---
async function loadSalesRecords() {
  const tbody = document.getElementById('salesRecordsTableBody');
  const filterDate = document.getElementById('filterSalesDate')?.value;
  let query = db.collection('sales').orderBy('timestamp', 'desc');
  
  if (filterDate) {
    query = query.where('date', '==', filterDate);
  }
  
  const snapshot = await query.get();
  tbody.innerHTML = '';
  
  snapshot.forEach(doc => {
    const sale = doc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${sale.date}</td>
      <td>${sale.clientName}</td>
      <td>${sale.clientPhone}</td>
      <td>${sale.itemName}</td>
      <td>${sale.barcode}</td>
      <td>${sale.quantity}</td>
      <td>${sale.sellingPrice.toFixed(2)}</td>
      <td>${sale.totalSale.toFixed(2)}</td>
      <td>${sale.saleType}</td>
      <td><button onclick="generateReceiptById('${doc.id}')">Print</button></td>
    `;
    tbody.appendChild(tr);
  });
}
window.loadSalesRecords = loadSalesRecords;

// --- Credit Sales Table ---
async function loadCreditSales() {
  const snapshot = await db.collection('creditSales').orderBy('timestamp', 'desc').get();
  const tbody = document.getElementById('creditSalesTableBody');
  tbody.innerHTML = '';
  
  snapshot.forEach(doc => {
    const sale = doc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${sale.date}</td>
      <td>${sale.clientName}</td>
      <td>${sale.clientPhone}</td>
      <td>${sale.itemName}</td>
      <td>${sale.quantity}</td>
      <td>${sale.creditAmount.toFixed(2)}</td>
      <td>${sale.amountPaid.toFixed(2)}</td>
      <td>${sale.balance.toFixed(2)}</td>
      <td>${sale.dueDate || 'N/A'}</td>
      <td>${sale.status}</td>
      <td>
        <button onclick="payCredit('${doc.id}')">Pay</button>
        <button onclick="deleteCredit('${doc.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
window.loadCreditSales = loadCreditSales;

// Pay credit
async function payCredit(id) {
  const paymentStr = prompt('Enter payment amount:');
  const payment = parseFloat(paymentStr);
  
  if (isNaN(payment)) {
    alert('Please enter a valid number');
    return;
  }
  
  if (payment <= 0) {
    alert('Payment amount must be positive');
    return;
  }
  
  const docRef = db.collection('creditSales').doc(id);
  const docSnap = await docRef.get();
  
  if (!docSnap.exists) {
    alert('Credit sale not found');
    return;
  }
  
  const data = docSnap.data();
  const newAmountPaid = (data.amountPaid || 0) + payment;
  const newBalance = (data.balance || 0) - payment;
  
  if (newBalance < 0) {
    alert('Payment exceeds balance');
    return;
  }
  const newStatus = newBalance <= 0 ? 'Paid' : 'Partial';
  
  await docRef.update({
    amountPaid: newAmountPaid,
    balance: newBalance,
    status: newStatus,
    lastPaymentDate: new Date().toISOString().split('T')[0]
  });
  
  alert('Payment recorded');
  loadCreditSales();
  calculateProfit();
}
window.payCredit = payCredit;

// Delete credit sale
async function deleteCredit(id) {
  if (confirm('Are you sure you want to delete this credit sale?')) {
    await db.collection('creditSales').doc(id).delete();
    alert('Credit sale deleted');
    loadCreditSales();
  }
}
window.deleteCredit = deleteCredit;

// Calculate profit & loss
async function calculateProfit() {
  const salesSnap = await db.collection('sales').get();
  const creditSnap = await db.collection('creditSales').get();
  
  let totalSales = 0;
  let totalCost = 0;
  let totalProfit = 0;
  
  salesSnap.forEach(doc => {
    const sale = doc.data();
    totalSales += sale.totalSale || 0;
    totalCost += sale.totalCost || 0;
  });
  
  creditSnap.forEach(doc => {
    const credit = doc.data();
    totalSales += credit.amountPaid || 0; // Only count paid amounts
    totalCost += (credit.costPrice * credit.quantity) || 0;
  });
  
  totalProfit = totalSales - totalCost;
  
  document.getElementById('totalSales').textContent = totalSales.toFixed(2);
  document.getElementById('totalCost').textContent = totalCost.toFixed(2);
  document.getElementById('profit').textContent = totalProfit.toFixed(2);
  
  // Color coding for profit
  const profitElement = document.getElementById('profit');
  profitElement.style.color = totalProfit >= 0 ? 'green' : 'red';
}
window.calculateProfit = calculateProfit;

// Generate PDF receipt using PDFMake
function generateReceipt(saleData) {
  // Create table rows for items
  const itemsBody = [
    [
      { text: 'Item', bold: true },
      { text: 'Qty', bold: true },
      { text: 'Price', bold: true },
      { text: 'Total', bold: true }
    ]
  ];
  
  saleData.items.forEach(item => {
    itemsBody.push([
      item.itemName,
      item.quantity,
      item.sellingPrice.toFixed(2),
      item.total.toFixed(2)
    ]);
  });
  
  // Calculate grand total
  const grandTotal = saleData.items.reduce((sum, item) => sum + item.total, 0);
  
  const docDefinition = {
    content: [
      { text: 'Gaden Digitech Limited', style: 'header' },
      { text: 'SALES RECEIPT', style: 'subheader', margin: [0, 0, 0, 10] },
      { text: `Date: ${saleData.date}` },
      { text: `Receipt No: ${saleData.id}` },
      { text: `Client: ${saleData.clientName}` },
      { text: `Phone: ${saleData.clientPhone || 'N/A'}` },
      { text: `Payment Type: ${saleData.saleType}` },
      { text: '\n' },
      {
        table: {
          widths: ['*', 'auto', 'auto', 'auto'],
          body: itemsBody
        }
      },
      { text: '\n' },
      { 
        text: `Grand Total: KSH ${grandTotal.toFixed(2)}`, 
        style: 'total',
        margin: [0, 0, 0, 20]
      },
      { 
        text: 'Thank you for your business!', 
        style: 'footer',
        margin: [0, 20, 0, 0]
      }
    ],
    styles: {
      header: { 
        fontSize: 18, 
        bold: true, 
        alignment: 'center',
        margin: [0, 0, 0, 5]
      },
      subheader: { 
        fontSize: 14, 
        bold: true, 
        alignment: 'center',
        margin: [0, 0, 0, 10]
      },
      total: {
        fontSize: 14,
        bold: true,
        alignment: 'right'
      },
      footer: {
        italics: true,
        alignment: 'center'
      }
    }
  };
  
  pdfMake.createPdf(docDefinition).open();
}
window.generateReceipt = generateReceipt;

// Generate receipt by ID
function generateReceiptById(id) {
  db.collection('sales').doc(id).get().then(doc => {
    if (doc.exists) {
      const sale = doc.data();
      generateReceipt({
        id: doc.id,
        date: sale.date,
        clientName: sale.clientName,
        clientPhone: sale.clientPhone,
        saleType: sale.saleType,
        items: [{
          itemName: sale.itemName,
          quantity: sale.quantity,
          sellingPrice: sale.sellingPrice,
          total: sale.totalSale
        }]
      });
    }
  });
}
window.generateReceiptById = generateReceiptById;

// --- Filter sales by date ---
document.getElementById('filterSalesBtn')?.addEventListener('click', loadSalesRecords);

// --- Auto-focus barcode input on page load ---
window.onload = () => {
  document.getElementById('saleBarcode')?.focus();
  loadCreditSales();
  loadSalesRecords();
  calculateProfit();
};