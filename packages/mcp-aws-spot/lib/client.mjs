import { EC2Client, DescribeSpotPriceHistoryCommand, DescribeAvailabilityZonesCommand, DescribeInstanceTypesCommand, GetSpotPlacementScoresCommand } from '@aws-sdk/client-ec2';

export { EC2Client, DescribeSpotPriceHistoryCommand, DescribeAvailabilityZonesCommand, DescribeInstanceTypesCommand, GetSpotPlacementScoresCommand };

export function createClient(credentials) {
  const ClientCtor = credentials?._EC2Client || EC2Client;

  function getClient(region) {
    const cfg = { region };
    if (credentials?.accessKeyId) {
      cfg.credentials = {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey
      };
    }
    return new ClientCtor(cfg);
  }

  return { getClient };
}

export function fmt$(price) {
  return `$${parseFloat(price).toFixed(4)}/hr`;
}
