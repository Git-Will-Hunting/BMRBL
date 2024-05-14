const fs = require('fs');

// Read the environment variable value from process.env
const apiKey = process.env.GAPI_KEY;

// Generate a JavaScript file with the environment variable value
const content = `const GAPI_KEY = '${apiKey}';
export default GAPI_KEY;`;

// Write the content to config.js
fs.writeFileSync('src/config.js', content);
