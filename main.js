import GAPI_KEY from './config.js'
const gapiLoadPromise = new Promise((resolve, reject) => {
  gapiLoadOkay = resolve;
  gapiLoadFail = reject;
});
const gisLoadPromise = new Promise((resolve, reject) => {
  gisLoadOkay = resolve;
  gisLoadFail = reject;
});

var tokenClient;

(async () => {
  document.getElementById("showEventsBtn").style.visibility="hidden";
  document.getElementById("revokeBtn").style.visibility="hidden";

  // First, load and initialize the gapi.client
  await gapiLoadPromise;
  await new Promise((resolve, reject) => {
    // NOTE: the 'auth2' module is no longer loaded.
    gapi.load('client', {callback: resolve, onerror: reject});
  });
  await gapi.client.init({
    // NOTE: OAuth2 'scope' and 'client_id' parameters have moved to initTokenClient().
  })
  .then(function() {  // Load the Calendar API discovery document.
    gapi.client.load('https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest');
    gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4');
  });

  // Now load the GIS client
  await gisLoadPromise;
  await new Promise((resolve, reject) => {
    try {
      tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: '753289278608-1p0ahebm5367kj1ev0c68h3poodhpn06.apps.googleusercontent.com',
          scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.file',
          prompt: 'consent',
          callback: '',  // defined at request time in await/promise scope.
      });
      resolve();
    } catch (err) {
      reject(err);
    }
  });

  document.getElementById("showEventsBtn").style.visibility="visible";
  document.getElementById("revokeBtn").style.visibility="visible";
})();

async function getToken(err) {
  if (!err) {
    await new Promise((resolve, reject) => {
      try {
        // Settle this promise in the response callback for requestAccessToken()
        tokenClient.callback = (resp) => {
          if (resp.error !== undefined) {
            reject(resp);
          }
          // GIS has automatically updated gapi.client with the newly issued access token.
          console.debug('gapi.client access token: ' + JSON.stringify(gapi.client.getToken()));
          resolve(resp);
        };
        tokenClient.requestAccessToken();
      } catch (err) {
        console.error(err)
      }
    });
    
  } else if (err.result.error.code == 401 || (err.result.error.code == 403) &&
  (err.result.error.status == "PERMISSION_DENIED")) {
    // The access token is missing, invalid, or expired, prompt for user consent to obtain one.
    await new Promise((resolve, reject) => {
      try {
        // Settle this promise in the response callback for requestAccessToken()
        tokenClient.callback = (resp) => {
          if (resp.error !== undefined) {
            reject(resp);
          }
          // GIS has automatically updated gapi.client with the newly issued access token.
          console.debug('gapi.client access token: ' + JSON.stringify(gapi.client.getToken()));
          resolve(resp);
        };
        tokenClient.requestAccessToken();
      } catch (err) {
        console.error(err)
      }
    });
  } else {
    // Errors unrelated to authorization: server errors, exceeding quota, bad requests, and so on.
    throw new Error(err);
  }
}

let myCalendars = [];
var umpireCalendarId;
async function findOrCreateCalendar(calendarName = 'BMRBL Umpire - d6c1b') {
    myCalendars = [];
    
    gapi.client.calendar.calendarList.list()
    .then(response => {
      // Populate myCalendars array with data from API response
      response.result.items.forEach(item => {
        myCalendars.push({
          summary: item.summary,
          id: item.id
        });
    });

      // Find matching calendar after myCalendars is populated
      const matchingCalendar = myCalendars.find(calendar => calendar.summary === 'BMRBL Umpire - d6c1b');
      console.debug(matchingCalendar);
      if (matchingCalendar) {
        console.debug(matchingCalendar.id);
        return umpireCalendarId = matchingCalendar.id
      } else {
        // Create new calendar if no matching calendar found
        gapi.client.calendar.calendars.insert({
            summary: calendarName
        })
        .then(newCalendar => {
          console.debug(newCalendar.result);
          myCalendars.push({
            summary: newCalendar.result.summary,
            id: newCalendar.result.id
          });
          return umpireCalendarId = newCalendar.result.id
        });
      }
    })
    .catch(err => {
      getToken(err); // Obtain access token for authorization errors
      alert('Error retrieving calendar list: 14x002');
      console.error('Error retrieving calendar list: ', err);
      throw err;
    });
    return umpireCalendarId
  }

function revokeToken() {
  let cred = gapi.client.getToken();
  if (cred !== null) {
    google.accounts.oauth2.revoke(cred.access_token, () => {console.debug('Revoked: ' + cred.access_token)});
    gapi.client.setToken('');
  }
}

let gameList = null
let contactList = null
let umpireList = []
var filteredData

// Make sure the client is loaded and sign-in is complete before calling this method.
async function fetchData() {
  const sheetsAPI = gapi.client.sheets.spreadsheets;
  return sheetsAPI.get({
    'spreadsheetId': '1nDPHswUSq1KP6VZhvhYDAjjg-3reWuyWdbA9J0csHUg',
    'includeGridData': true,
    'ranges': [
      'BMRBL SEASON SCHEDULE!A1:H400',
      'CONTACT LIST!A1:F82'
    ],
    'apiKey': GAPI_KEY
  })
  .then(response => {
    gameList = response.result.sheets[0].data[0].rowData;
    contactList = [];
    response.result.sheets[1].data[0].rowData.forEach(row => {
      contactList.push({
        'name': row.values[1].formattedValue + ' ' + row.values[2].formattedValue,
        'cell': row.values[3].formattedValue
      })
    });
    // Handle the results here (response.result has the parsed body).
    console.debug('Sheet data: ', gameList);
    createDropdownList();
    displayOutputToUser('Data loaded, dropdown list now available.')
  })
  .catch(err => {
    getToken(err); // Obtain access token for authorization errors
    alert('Error fetching data: 14x003');
    console.error('Error fetching data: ', err);
    throw err;
  })
}

// // Function to parse data and create dropdown list of unique values
// // this is automatically run after the sheet data is retrieved
function createDropdownList() {
  var rawUmpires = []
for (var i = 5; i < 400; i++){
  rawUmpires.push(gameList[i].values[4].formattedValue);
  rawUmpires.push(gameList[i].values[5].formattedValue);}
  // Get unique values
  umpireList = [...new Set(rawUmpires)];

  // Populate the dropdown selector with unique values
  const nameSelect = document.getElementById('name-select');
  umpireList.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    nameSelect.appendChild(option);
  });

  // Add event listener to handle selection change
  nameSelect.addEventListener('change', filterAndDisplayData);
}

// Function to display data
function filterAndDisplayData() {
  const selectedName = document.getElementById('name-select').value; // Get the selected value from the dropdown
  filteredData = filterData(selectedName);
  displayOutputToUser(`Showing data for ${selectedName}`);
  
  // Populate the table with filtered data
  populateTable(filteredData);
  return filteredData;
}

// Function to filter data based on selected name
function filterData(selectedName){
  if (selectedName === 'Select...') {
    return gameList.slice(4, 400);
  }  else if (!selectedName || selectedName.trim() === '') {
    // If selectedName is not set or blank, include rows with blank values in column index 4 or 5
    return gameList.filter(row => {
      return !row.values[4] || row.values[4].formattedValue.trim() === '' ||  // Check if column index 4 is empty
             !row.values[5] || row.values[5].formattedValue.trim() === '';    // Check if column index 5 is empty  });
    });
  } else {
    // If selectedName is set, filter rows based on the selected name
    return gameList.filter(row => {
      return row.values.some(cellObject => {
        return cellObject.formattedValue === selectedName;
      });
    });
  }
}

// Function to populate the table with data
function populateTable(data) {
  const table = document.getElementById('data-table');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  // Clear existing table content
  thead.innerHTML = '';
  tbody.innerHTML = '';

  // Populate table headers with data from row 3
  const headersRow = document.createElement('tr');
  gameList[2].values.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header.formattedValue;
    headersRow.appendChild(th);
  });
  thead.appendChild(headersRow);

  // Populate table body with filtered data
  console.debug(data);
  data.forEach(rowData => {
    const tr = document.createElement('tr');
    rowData.values.forEach(cellData => {
      const td = document.createElement('td');
      td.textContent = cellData.formattedValue;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}
// deletes the created BMRBL Calendar
function deleteCalendar(){
  gapi.client.calendar.calendarList.delete({
    'calendarId': umpireCalendarId
  })
  .then(response => {console.debug(response)})
  alert('Deleted the BMRBL Umpire calendar created by this app.');
  displayOutputToUser('Deleted the BMRBL Umpire calendar created by this app.');
}
// UI creation & function
const dataTools = document.getElementById('data-tools')

const eventCreatorBtn = document.getElementById('createEventsBtn')
eventCreatorBtn.addEventListener('click', ()=> {
  addEventsToCalendar();
});

const deleteCalendarBtn = document.getElementById('deleteCalendarBtn')
deleteCalendarBtn.addEventListener('click', ()=> {
  deleteCalendar();
});

const fetchDataButton = document.getElementById('fetchDataBtn')
fetchDataButton.addEventListener('click', ()=> {
  fetchData();
  findOrCreateCalendar();
});

// const filterDataButton = document.createElement('button');
// filterDataButton.textContent = ('Filter Data');
// dataTools.appendChild(filterDataButton)
// filterDataButton.addEventListener('click', ()=> {
//   filterAndDisplayData();
// });


async function addEventsToCalendar(){
  // find or create the calendar and return ID
  //const calendarId = await findOrCreateCalendar();
  const eventData = await generateEventData();
  const batch = gapi.client.newBatch();
  eventData[0].forEach(event => {
    const individualRequest = gapi.client.calendar.events.insert({
      resource: event,
      calendarId: umpireCalendarId
    })
    console.debug('request content: ' + individualRequest);
    batch.add(individualRequest);
  })
  batch.then(response => {
    alert('Events created successfully!');
    displayOutputToUser('Created the events shown in the table.');
    console.debug('Batch request succeeded:', response);
  })
  .catch((error => {
    alert('Error handling batch request: 14x001')
    console.error('Error handling batch request: ' + JSON.stringify(error))
  }));
}

function convertParkToAddress(park) {
  switch(park){
    case 'FCCC':
      return '8850 McLaughlin Rd S #1, Brampton, ON L6Y 5T1';
    case 'CHRIS GIBSON':
      return 'Flowertown Ave & McLaughlin Rd N, Brampton, ON L6X 2J3';
    case 'DAVE DASH':
      return '48 McMurchy Ave S, Brampton, ON L6Y 2K5';
    case 'TERAMOTO RED':
      return '9056 Chinguacousy Rd, Brampton, ON L6X 0B2';
    case 'TERAMOTO YELLOW':
      return '9056 Chinguacousy Rd, Brampton, ON L6X 0B2';
    case 'MORRIS KERBAL':
      return '292 Conestoga Dr, Brampton, ON L6Z 3M1';
    default:
      return '';
    }
}
// Create event data struct
// Assuming filteredData is an array of objects where each object represents a row from the filtered data
// Each object contains properties corresponding to the columns in the filtered data

// generateEventData takes in an array from the sheet and formats the information for calendar
// returns an array of event objects
async function generateEventData(){
  const gameData = filterAndDisplayData();
  let eventDataArray = []
  eventDataArray.push(gameData.map(row => {
    // Extract values from the row
    let summary = toTitleCase(row.values[3].formattedValue);
    var description;
    const dateWithoutYear = row.values[1].formattedValue; // Assuming date format is 'MM/DD'
    const startTime = row.values[2].formattedValue;
    const locationKey = row.values[3].formattedValue;
    const selectedName = document.getElementById('name-select').value;
  
    // Determine summary based on conditions
    if (row.values[4].formattedValue === selectedName) {
      summary += ' Plate';
      description = 'Working with ' + row.values[5].formattedValue;
      if(row.values[5].formattedValue){
        var partner = contactList.find(name => name.name ===  row.values[5].formattedValue);
        partner ? description += '\n phone: ' + partner.cell : description;
      }
    } else if (row.values[5].formattedValue === selectedName) {
      summary += ' Base';
      description = 'Working with ' + row.values[4].formattedValue;
      if(row.values[4].formattedValue){
        var partner = contactList.find(name => name.name ===  row.values[4].formattedValue);
        partner ? description += '\n phone: ' + partner.cell : description
      }
    }
  
    // Convert location key to physical address
    const physicalAddress = convertParkToAddress(locationKey);
  
    // Construct full date string with the current year
    const currentYear = new Date().getFullYear(); // Get the current year
    const dateWithYear = `${dateWithoutYear} ${currentYear}`;
  
    // Calculate start and end date-time
    const startDateTime = new Date(`${dateWithYear} ${startTime}`);
    const endDateTime = new Date(startDateTime.getTime() + 2.5 * 60 * 60 * 1000); // Add 2.5 hours
    // Construct eventData object
    return {
      summary,
      'location': physicalAddress,
      'start': {
        'dateTime': startDateTime.toISOString()
      },
      'end': {
        'dateTime': endDateTime.toISOString()
      },
      'description': description
    };
  }));
  displayOutputToUser(eventDataArray);
  return eventDataArray;
}

function getContactInfo(row, index){
  contactList.find(name => name.name ===  row.values[index].formattedValue).cell
}
function toTitleCase(str) {
  if (str === '') {return};
  return str.replace(
    /\w\S*/g,
    function(txt) {
      if(txt === 'FCCC'){
        return txt;
      }
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }
  );
}

function displayOutputToUser(jsonData) {
  const jsonOutputDiv = document.getElementById('resultsContainer');
  jsonOutputDiv.textContent = 'Function succeeded with result: \n'
  jsonOutputDiv.textContent += JSON.stringify(jsonData, null, 2); // Beautify JSON with 2-space indentation
}
