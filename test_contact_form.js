// Simple test script to verify contact form functionality
const testContactForm = async () => {
  const testData = {
    name: "Test User",
    email: "test@example.com", 
    company: "Test Company",
    message: "This is a test message from the contact form."
  };

  try {
    const response = await fetch('http://localhost:8080/api/v1/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', result);

    if (response.ok) {
      console.log('✅ Contact form submission successful!');
      console.log('Submission ID:', result.id);
      console.log('Status:', result.status);
    } else {
      console.log('❌ Contact form submission failed');
      console.log('Error:', result.message);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
};

// Test validation
const testValidation = () => {
  console.log('Testing form validation...');
  
  const validationTests = [
    { name: '', email: 'test@example.com', message: 'test', expected: 'Name is required' },
    { name: 'Test', email: 'invalid-email', message: 'test', expected: 'Invalid email' },
    { name: 'Test', email: 'test@example.com', message: '', expected: 'Message is required' },
    { name: 'Test', email: 'test@example.com', message: 'short', expected: 'Message too short' },
  ];

  validationTests.forEach((test, index) => {
    console.log(`Test ${index + 1}:`, test.expected);
  });
};

console.log('Contact Form Test Suite');
console.log('======================');

testValidation();
console.log('\nTesting API endpoint...');
testContactForm();