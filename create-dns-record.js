const express = require('express');
const bodyParser = require('body-parser');
const AWS = require('aws-sdk');
const cors = require('cors');

const app = express();


app.use(cors({
  origin: 'http://localhost:3000', 
  methods: ['GET', 'POST'], 
  allowedHeaders: ['Content-Type', 'Authorization'], 
}));


app.use(bodyParser.json());


AWS.config.update({ region: 'ap-south-1' });
const route53 = new AWS.Route53();

// Endpoint to handle DNS record creation
app.post('/api/dns/create', async (req, res) => {
  // Extract DNS record data from request body
  const { domain, type, value } = req.body;

  console.log('Received DNS record data:', { domain, type, value }); 

  try {
    // Check if a hosted zone exists for the domain
    let hostedZone = await checkHostedZone(domain);
    
    console.log('Checked hosted zone:', hostedZone); 

    // If no hosted zone exists, create a new one
    if (!hostedZone) {
      console.log('Creating new hosted zone for domain:', domain);
      hostedZone = await createHostedZone(domain);
    }

    // Define parameters for creating a DNS record
    const params = {
      HostedZoneId: hostedZone.Id,
      ChangeBatch: {
        Changes: [
          {
            Action: 'CREATE',
            ResourceRecordSet: {
              Name: domain,
              Type: type,
              TTL: 300,
              ResourceRecords: [
                {
                  Value: value,
                },
              ],
            },
          },
        ],
      },
    };

    console.log('Creating DNS record with params:', params); 

    // Call the changeResourceRecordSets method to create the DNS record
    await route53.changeResourceRecordSets(params).promise();

    console.log('DNS record created successfully');
    res.json({ message: 'DNS record created successfully' });
  } catch (err) {
    console.error('Error creating DNS record:', err);
    // res.status(500).json({ error: 'DNS record' });
  }
});

// Function to check if a hosted zone exists for the domain
async function checkHostedZone(domain) {
  const { HostedZones } = await route53.listHostedZonesByName({ DNSName: domain }).promise();
  return HostedZones.find(zone => zone.Name === domain);
}

// Function to create a new hosted zone for the domain
async function createHostedZone(domain) {
  const { HostedZone } = await route53.createHostedZone({
    Name: domain,
    CallerReference: `create-hosted-zone-${Date.now()}`,
  }).promise();
  
  console.log('Hosted zone created successfully:', HostedZone.Id);
  return HostedZone;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
