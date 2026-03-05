// Using built-in fetch

async function fetchCategories() {
  try {
    console.log('Fetching categories...');
    
    const response = await fetch('http://localhost:3000/api/categories', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Categories:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.categories && data.categories.length > 0) {
      console.log('✅ Found categories! First category ID:', data.categories[0].id);
      return data.categories[0].id;
    } else {
      console.log('❌ No categories found or error occurred');
      return null;
    }
  } catch (error) {
    console.error('❌ Error fetching categories:', error.message);
    return null;
  }
}

fetchCategories();
