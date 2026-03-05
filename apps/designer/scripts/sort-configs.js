#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

// Function to sort object keys alphabetically
function sortObjectKeys(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return obj;
  }
  
  const sorted = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = sortObjectKeys(obj[key]);
  });
  
  return sorted;
}

// Function to sort defaultDesignSettings specifically
function sortDefaultDesignSettings(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Find the defaultDesignSettings object
    const regex = /export const defaultDesignSettings: DesignSettings = \{([\s\S]*?)\};/;
    const match = content.match(regex);
    
    if (match) {
      const objectContent = match[1];
      
      // Parse the object content
      const lines = objectContent.split('\n');
      const properties = [];
      const comments = [];
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines
        if (!trimmed) continue;
        
        // Handle comments
        if (trimmed.startsWith('//')) {
          comments.push(trimmed);
          continue;
        }
        
        // Handle properties
        if (trimmed.includes(':') && !trimmed.startsWith('//')) {
          // Remove all trailing commas
          const cleanLine = trimmed.replace(/,+$/, '');
          properties.push(cleanLine);
        }
      }
      
      // Extract property names and values
      const propertyMap = {};
      
      for (const prop of properties) {
        if (prop.includes(':')) {
          const colonIndex = prop.indexOf(':');
          const key = prop.substring(0, colonIndex).trim();
          const value = prop.substring(colonIndex + 1).trim();
          propertyMap[key] = value;
        }
      }
      
      // Sort the properties alphabetically
      const sortedKeys = Object.keys(propertyMap).sort();
      
      // Rebuild the object content
      let newObjectContent = '\n';
      
      // Add comments at the top
      comments.forEach(comment => {
        newObjectContent += '  ' + comment + '\n';
      });
      
      // Add sorted properties with correct commas
      sortedKeys.forEach((key, index) => {
        const isLast = index === sortedKeys.length - 1;
        const comma = isLast ? '' : ',';
        newObjectContent += `  ${key}: ${propertyMap[key]}${comma}\n`;
      });
      
      // Replace the original object content
      const newContent = content.replace(regex, `export const defaultDesignSettings: DesignSettings = {${newObjectContent}};`);
      
      fs.writeFileSync(filePath, newContent, 'utf8');
      logSuccess(`Sorted defaultDesignSettings in ${path.relative(process.cwd(), filePath)}`);
      return true;
    } else {
      logError(`Could not find defaultDesignSettings in ${filePath}`);
      return false;
    }
  } catch (error) {
    logError(`Error processing ${filePath}: ${error.message}`);
    return false;
  }
}

// Main function
function main() {
  log('🔄 Sorting config objects alphabetically...', 'bright');
  
  const files = [
    'apps/designer/src/types/design.ts',
    'apps/widget/types/design.ts'
  ];
  
  let successCount = 0;
  
  files.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      if (sortDefaultDesignSettings(filePath)) {
        successCount++;
      }
    } else {
      logError(`File not found: ${filePath}`);
    }
  });
  
  log(`\n🎉 Completed! Sorted ${successCount}/${files.length} files.`, 'bright');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { sortDefaultDesignSettings, sortObjectKeys }; 