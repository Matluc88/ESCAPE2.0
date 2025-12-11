#!/usr/bin/env node

/**
 * MQTT Test Script for ESP32 Fridge Light
 * 
 * This script tests the MQTT communication with the ESP32 device
 * that controls the fridge light in the escape room.
 * 
 * Broker: broker.hivemq.com:1883
 * Command Topic: home/cucina/frigo/comando
 * Status Topic: home/cucina/frigo/stato
 * 
 * Commands: ON, OFF (case-sensitive)
 * Responses: ACCESO, SPENTO
 */

const mqtt = require('mqtt');

const BROKER_URL = 'mqtt://broker.hivemq.com:1883';
const COMMAND_TOPIC = 'home/cucina/frigo/comando';
const STATUS_TOPIC = 'home/cucina/frigo/stato';

const TEST_TIMEOUT = 5000; // 5 seconds timeout for each test
const DELAY_BETWEEN_TESTS = 1000; // 1 second delay between tests

const testResults = [];
let currentTest = null;

let client = null;

/**
 * Connect to MQTT Broker
 */
function connectToBroker() {
  return new Promise((resolve, reject) => {
    console.log('🔌 Connecting to MQTT broker:', BROKER_URL);
    
    client = mqtt.connect(BROKER_URL, {
      clientId: `mqtt-test-${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 0
    });

    client.on('connect', () => {
      console.log('✅ Connected to MQTT broker\n');
      resolve();
    });

    client.on('error', (error) => {
      console.error('❌ Connection error:', error.message);
      reject(error);
    });
  });
}

/**
 * Subscribe to status topic
 */
function subscribeToStatus() {
  return new Promise((resolve, reject) => {
    console.log('📡 Subscribing to status topic:', STATUS_TOPIC);
    
    client.subscribe(STATUS_TOPIC, (err) => {
      if (err) {
        console.error('❌ Subscription error:', err.message);
        reject(err);
      } else {
        console.log('✅ Subscribed to status topic\n');
        resolve();
      }
    });
  });
}

/**
 * Send command and wait for response
 */
function sendCommandAndWaitForResponse(command, expectedResponse) {
  return new Promise((resolve, reject) => {
    let timeoutId = null;
    let messageHandler = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (messageHandler) client.off('message', messageHandler);
    };

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout: No response received within ${TEST_TIMEOUT}ms`));
    }, TEST_TIMEOUT);

    messageHandler = (topic, message) => {
      if (topic === STATUS_TOPIC) {
        const response = message.toString();
        cleanup();
        resolve(response);
      }
    };

    client.on('message', messageHandler);

    console.log(`📤 Sending command: "${command}" to topic: ${COMMAND_TOPIC}`);
    client.publish(COMMAND_TOPIC, command, { qos: 0 }, (err) => {
      if (err) {
        cleanup();
        reject(new Error(`Failed to publish command: ${err.message}`));
      }
    });
  });
}

/**
 * Run a single test
 */
async function runTest(testNumber, command, expectedResponse) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 TEST ${testNumber}: Sending "${command}" - Expecting "${expectedResponse}"`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  
  try {
    const response = await sendCommandAndWaitForResponse(command, expectedResponse);
    const duration = Date.now() - startTime;
    
    console.log(`📥 Received response: "${response}" (${duration}ms)`);
    
    const passed = response === expectedResponse;
    
    if (passed) {
      console.log(`✅ TEST ${testNumber} PASSED: Response matches expected value`);
    } else {
      console.log(`❌ TEST ${testNumber} FAILED: Expected "${expectedResponse}", got "${response}"`);
    }
    
    testResults.push({
      testNumber,
      command,
      expectedResponse,
      actualResponse: response,
      passed,
      duration
    });
    
    return passed;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ TEST ${testNumber} FAILED: ${error.message}`);
    
    testResults.push({
      testNumber,
      command,
      expectedResponse,
      actualResponse: null,
      passed: false,
      error: error.message,
      duration
    });
    
    return false;
  }
}

/**
 * Wait for a specified duration
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Print final test report
 */
function printTestReport() {
  console.log('\n\n');
  console.log('='.repeat(60));
  console.log('📊 FINAL TEST REPORT');
  console.log('='.repeat(60));
  
  const passedTests = testResults.filter(t => t.passed).length;
  const totalTests = testResults.length;
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  console.log(`\nTotal Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${successRate}%\n`);
  
  console.log('Detailed Results:');
  console.log('-'.repeat(60));
  
  testResults.forEach((result) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`\nTest ${result.testNumber}: ${status}`);
    console.log(`  Command: ${result.command}`);
    console.log(`  Expected: ${result.expectedResponse}`);
    console.log(`  Actual: ${result.actualResponse || 'No response'}`);
    console.log(`  Duration: ${result.duration}ms`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  });
  
  console.log('\n' + '='.repeat(60));
  
  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED! The ESP32 is working correctly.');
  } else {
    console.log('⚠️  SOME TESTS FAILED. Please check the ESP32 connection and code.');
  }
  console.log('='.repeat(60) + '\n');
}

/**
 * Main test execution
 */
async function runAllTests() {
  try {
    await connectToBroker();
    
    await subscribeToStatus();
    
    await wait(1000);
    
    await runTest(1, 'ON', 'ACCESO');
    await wait(DELAY_BETWEEN_TESTS);
    
    await runTest(2, 'OFF', 'SPENTO');
    await wait(DELAY_BETWEEN_TESTS);
    
    await runTest(3, 'ON', 'ACCESO');
    await wait(DELAY_BETWEEN_TESTS);
    
    await runTest(4, 'OFF', 'SPENTO');
    
    printTestReport();
    
    console.log('🔌 Disconnecting from broker...');
    client.end();
    console.log('✅ Disconnected\n');
    
    const allPassed = testResults.every(t => t.passed);
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    if (client) {
      client.end();
    }
    process.exit(1);
  }
}

console.log('\n🚀 Starting MQTT Test Suite for ESP32 Fridge Light\n');
runAllTests();
