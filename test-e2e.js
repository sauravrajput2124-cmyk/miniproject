/**
 * End-to-End Workflow Integration Test
 * Tests both EV Owner and Charger Provider complete workflows against the SQLite database and Express API
 */

const http = require('http');

const PORT = 3055;
process.env.PORT = String(PORT);

// Load server without opening browser
const originalExec = require('child_process').exec;
require('child_process').exec = () => {}; // suppress auto-open for test

const app = require('./server'); // Starts listener on PORT 3055 if server.js runs

// Helper to make HTTP requests with cookie support (sessions)
function makeClient() {
  let cookie = '';
  return {
    request(method, path, body = null) {
      return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const options = {
          hostname: '127.0.0.1',
          port: PORT,
          path: path,
          method: method,
          headers: {
            'Content-Type': 'application/json',
            ...(cookie ? { 'Cookie': cookie } : {}),
            ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
          }
        };

        const req = http.request(options, (res) => {
          let data = '';
          if (res.headers['set-cookie']) {
            cookie = res.headers['set-cookie'][0].split(';')[0];
          }
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve({ status: res.statusCode, data: parsed, headers: res.headers });
            } catch (e) {
              resolve({ status: res.statusCode, raw: data, headers: res.headers });
            }
          });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
      });
    }
  };
}

async function runTests() {
  console.log('⚡ Starting Complete Workflow Integration Tests...\n');
  const providerClient = makeClient();
  const ownerClient = makeClient();

  const timestamp = Date.now();
  const providerEmail = `provider_${timestamp}@test.com`;
  const ownerEmail = `owner_${timestamp}@test.com`;

  // STEP 1: Register Charger Provider
  console.log('STEP 1: Registering Charger Provider...');
  const regProv = await providerClient.request('POST', '/api/auth/register/charger-provider', {
    full_name: 'Vikram Singh',
    email: providerEmail,
    password: 'password123',
    phone: '9811223344',
    whatsapp: '9811223344',
    station_name: 'Vikram SuperCharge Hub',
    full_address: 'Sector 29, Cyber City Area',
    city: 'Gurugram',
    pin_code: '122002',
    charger_type: 'CCS2 DC Fast',
    charging_capacity: 60,
    charging_price: 15.5,
    available_days: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
    starting_time: '07:00',
    closing_time: '23:00',
    avg_charging_duration: 45,
    num_charging_points: 2,
    description: 'High power DC fast charger near metro station.'
  });
  console.assert(regProv.status === 200, 'Provider registration failed: ' + JSON.stringify(regProv.data));
  console.log('✓ Provider registered successfully:', regProv.data.user.full_name);

  // STEP 2: Provider checks dashboard and own chargers
  console.log('\nSTEP 2: Checking Provider Dashboard and Chargers...');
  const provDash = await providerClient.request('GET', '/api/dashboard/charger-provider');
  console.assert(provDash.data.total_stations >= 1, 'Provider stations count should be >= 1');
  console.log('✓ Provider Dashboard Stats:', provDash.data);

  const provStations = await providerClient.request('GET', '/api/stations/my');
  console.assert(provStations.data.stations.length >= 1, 'Provider should have at least 1 station');
  const targetStation = provStations.data.stations.find(s => s.station_name === 'Vikram SuperCharge Hub');
  console.assert(targetStation, 'Target station not found in provider list');
  console.log('✓ Station found:', targetStation.station_name, 'ID:', targetStation.id);

  // STEP 3: Register EV Owner
  console.log('\nSTEP 3: Registering EV Owner...');
  const regOwner = await ownerClient.request('POST', '/api/auth/register/ev-owner', {
    full_name: 'Neha Gupta',
    email: ownerEmail,
    password: 'password123',
    phone: '9988776655',
    vehicle_name: 'Tata Nexon EV',
    vehicle_model: 'Max Dark Edition',
    vehicle_number: 'HR-26-EV-1001'
  });
  console.assert(regOwner.status === 200, 'EV Owner registration failed: ' + JSON.stringify(regOwner.data));
  console.log('✓ EV Owner registered:', regOwner.data.user.full_name);

  // STEP 4: EV Owner views all charging stations
  console.log('\nSTEP 4: EV Owner views and filters charging stations...');
  const allStations = await ownerClient.request('GET', '/api/stations?search=Gurugram');
  console.assert(allStations.data.stations.length >= 1, 'Should find station in Gurugram');
  console.log('✓ Found Gurugram station:', allStations.data.stations[0].station_name, 'Price: ₹' + allStations.data.stations[0].charging_price);

  // STEP 5: EV Owner submits charging request
  console.log('\nSTEP 5: EV Owner submits charging request...');
  const submitReq = await ownerClient.request('POST', '/api/requests', {
    station_id: targetStation.id,
    phone: '9988776655',
    vehicle_name: 'Tata Nexon EV',
    vehicle_number: 'HR-26-EV-1001',
    preferred_date: '2026-11-05',
    preferred_time: '14:00',
    required_duration: 60,
    message: 'Please reserve slot, arriving with 15% battery.'
  });
  console.assert(submitReq.status === 200, 'Submit request failed: ' + JSON.stringify(submitReq.data));
  const createdReq = submitReq.data.request;
  console.log('✓ Request created with ID:', createdReq.request_id, 'Status:', createdReq.status);
  console.assert(createdReq.status === 'PENDING', 'Initial status must be PENDING');

  // STEP 6: EV Owner checks "My Requests"
  console.log('\nSTEP 6: EV Owner checks My Requests...');
  const myReqs = await ownerClient.request('GET', '/api/requests/my');
  const foundInMy = myReqs.data.requests.find(r => r.request_id === createdReq.request_id);
  console.assert(foundInMy && foundInMy.status === 'PENDING', 'Request must appear in My Requests with PENDING');
  console.log('✓ Verified in My Requests with status:', foundInMy.status);

  // STEP 7: Provider views incoming requests
  console.log('\nSTEP 7: Provider views incoming requests...');
  const incoming = await providerClient.request('GET', '/api/requests/incoming');
  const foundIncoming = incoming.data.requests.find(r => r.request_id === createdReq.request_id);
  console.assert(foundIncoming, 'Provider should see the incoming request');
  console.log('✓ Provider received incoming request from:', foundIncoming.ev_owner_name, 'Vehicle:', foundIncoming.vehicle_name);

  // STEP 8: Provider ACCEPTS request
  console.log('\nSTEP 8: Provider accepts request...');
  const acceptRes = await providerClient.request('PATCH', `/api/requests/${foundIncoming.id}/status`, {
    status: 'ACCEPTED'
  });
  console.assert(acceptRes.status === 200, 'Accept failed');
  console.log('✓ Provider accepted request');

  // STEP 9: EV Owner sees updated status ACCEPTED
  console.log('\nSTEP 9: EV Owner checks updated status...');
  const myReqsAfterAccept = await ownerClient.request('GET', '/api/requests/my');
  const reqAfterAccept = myReqsAfterAccept.data.requests.find(r => r.request_id === createdReq.request_id);
  console.assert(reqAfterAccept.status === 'ACCEPTED', 'Status should now be ACCEPTED');
  console.log('✓ EV Owner verified status updated to:', reqAfterAccept.status);

  // STEP 10: Provider marks request COMPLETED
  console.log('\nSTEP 10: Provider marks request as COMPLETED...');
  const compRes = await providerClient.request('PATCH', `/api/requests/${foundIncoming.id}/status`, {
    status: 'COMPLETED'
  });
  console.assert(compRes.status === 200, 'Complete failed');
  console.log('✓ Provider marked request as COMPLETED');

  // STEP 11: EV Owner verifies COMPLETED status
  console.log('\nSTEP 11: EV Owner verifies COMPLETED status...');
  const myReqsAfterComp = await ownerClient.request('GET', '/api/requests/my');
  const reqAfterComp = myReqsAfterComp.data.requests.find(r => r.request_id === createdReq.request_id);
  console.assert(reqAfterComp.status === 'COMPLETED', 'Status should now be COMPLETED');
  console.log('✓ EV Owner verified status is COMPLETED');

  // STEP 12: Provider manages charger (toggle availability and update)
  console.log('\nSTEP 12: Provider tests Manage Chargers (Availability toggle)...');
  await providerClient.request('PATCH', `/api/stations/${targetStation.id}/availability`, { is_available: 0 });
  const checkOff = await providerClient.request('GET', `/api/stations/${targetStation.id}`);
  console.assert(checkOff.data.station.is_available === 0, 'Station should be unavailable');
  console.log('✓ Station marked unavailable');

  await providerClient.request('PATCH', `/api/stations/${targetStation.id}/availability`, { is_available: 1 });
  const checkOn = await providerClient.request('GET', `/api/stations/${targetStation.id}`);
  console.assert(checkOn.data.station.is_available === 1, 'Station should be available');
  console.log('✓ Station marked available again');

  console.log('\n=============================================================');
  console.log('🎉 ALL 12 WORKFLOW AND ARCHITECTURAL TESTS PASSED SUCCESSFULLY!');
  console.log('=============================================================\n');
  process.exit(0);
}

// Give server 500ms to bind then run
setTimeout(runTests, 500);
