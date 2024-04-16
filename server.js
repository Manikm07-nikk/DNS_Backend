const express = require('express');
const allowCors = require('./allowCors');
const bodyParser = require('body-parser');
const cors = require('cors');
const AWS = require('aws-sdk');

const app = express();

app.use(cors());

app.use(bodyParser.json());

// Set up AWS credentials and configure AWS SDK
AWS.config.update({ region: 'ap-south-1' });
const route53 = new AWS.Route53();

app.post('/api/dns/create', async (req, res) => {
  const { domain, type, value } = req.body;

  try {
    let hostedZone = await checkHostedZone(domain);

    if (!hostedZone) {
      hostedZone = await createHostedZone(domain);
    }

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
              ResourceRecords: [{ Value: value }],
            },
          },
        ],
      },
    };

    await route53.changeResourceRecordSets(params).promise();

    console.log('DNS record created successfully');
    res.json({ message: 'DNS record created successfully' });
  } catch (err) {
    console.error('Error creating DNS record:', err.stack); // Log the error stack trace
    // res.status(500).json({ error: 'Failed to create DNS record', details: err.message });
  }
});

app.get('/api/dns', async (req, res) => {
  try {
    // Retrieve all hosted zones
    const { HostedZones } = await route53.listHostedZones().promise();

    // Array to store DNS records
    const dnsRecords = [];

    // Iterate through hosted zones to fetch records
    for (const hostedZone of HostedZones) {
      // Retrieve DNS records for the hosted zone
      const { ResourceRecordSets } = await route53.listResourceRecordSets({
        HostedZoneId: hostedZone.Id,
      }).promise();

      // Push each record to the dnsRecords array
      for (const record of ResourceRecordSets) {
        if (record.Type === 'SOA' || record.Type === 'NS') {
          continue; // Skip this iteration and move to the next one
        }
        dnsRecords.push({
          hostedZoneId: hostedZone.Id,
          domain: record.Name,
          type: record.Type,
          value: record.ResourceRecords.map(record => record.Value).join(', '), // Concatenate multiple values if present
        });
      }
    }

    console.log('DNS records fetched successfully');
    res.json(dnsRecords);
  } catch (err) {
    console.error('Error fetching DNS records:', err.stack); // Log the error stack trace
    res.status(500).json({ error: 'Failed to fetch DNS records', details: err.message });
  }
});



app.delete('/api/dns/delete/:domain', async (req, res) => {
  const { domain } = req.params;
  let { type, values } = req.query;
  if(values.includes(',')){
    values = values.split(',').join('", "');
  }

  try {
    let hostedZone = await checkHostedZone(domain);

    if (!hostedZone) {
      res.json("Hosted Zone not found");
      return; // Exit the function if hosted zone not found
    }

    

    // console.log(resourceRecords);
    const params = {
      HostedZoneId: hostedZone.Id,
      ChangeBatch: {
        Changes: [
          {
            Action: 'DELETE',
            ResourceRecordSet: {
              Name: domain,
              Type: type,
              TTL: 300,
              ResourceRecords: [{Value : values.trim()}],
            },
          },
        ],
      },
    };

    await route53.changeResourceRecordSets(params).promise();

    console.log('DNS record deleted successfully');
    res.json({ message: 'DNS record deleted successfully' });
  } catch (err) {
    console.error('Error deleting DNS record:', err.stack); // Log the error stack trace
    res.status(500).json({ error: 'Failed to delete DNS record', details: err.message });
  }
});

async function checkHostedZone(domain) {
  const { HostedZones } = await route53.listHostedZonesByName({ DNSName: domain }).promise();
  return HostedZones.find(zone => zone.Name === domain);
}

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
