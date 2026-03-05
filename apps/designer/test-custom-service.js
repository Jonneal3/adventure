// Using built-in fetch

async function testCustomService() {
  try {
    console.log('Testing custom service creation...');
    
    const response = await fetch('http://localhost:3000/api/categories/subcategories/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subcategory: 'Test Custom Service',
        description: 'This is a test custom service description',
        categoryId: '023993ca-b768-4f19-bf61-24c3e59b5fbb', // Real category ID
        accountId: '4a589115-67bb-4ad6-93d9-dc921b4f9f67'   // Real account ID from the data
      })
    });

    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('✅ Custom service creation successful!');
    } else {
      console.log('❌ Custom service creation failed:', data.error);
    }
  } catch (error) {
    console.error('❌ Error testing custom service:', error.message);
  }
}

testCustomService();