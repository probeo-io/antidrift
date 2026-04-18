import { EC2Client, DescribeSpotPriceHistoryCommand, DescribeAvailabilityZonesCommand, DescribeInstanceTypesCommand, GetSpotPlacementScoresCommand } from '@aws-sdk/client-ec2';

export { EC2Client, DescribeSpotPriceHistoryCommand, DescribeAvailabilityZonesCommand, DescribeInstanceTypesCommand, GetSpotPlacementScoresCommand };

export function createClient(credentials) {
  function getClient(region) {
    const cfg = { region };
    if (credentials?.accessKeyId) {
      cfg.credentials = {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey
      };
    }
    return new EC2Client(cfg);
  }

  return { getClient };
}

export function fmt$(price) {
  return `$${parseFloat(price).toFixed(4)}/hr`;
}
