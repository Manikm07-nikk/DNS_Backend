const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const AWS = require('aws-sdk');

const app = express();

// Enable CORS for all routes
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
