#!/bin/sh
# Fake AWS CLI for Docker integration tests.
# Returns mock JSON responses for commands used by antidrift connectors.
case "$*" in
  *"sts get-caller-identity"*)
    echo '{"UserId":"FAKEUSER","Account":"123456789012","Arn":"arn:aws:iam::123456789012:user/test"}'
    ;;
  *"configure get region"*)
    echo "us-east-1"
    ;;
  *"ce get-cost-and-usage"*)
    echo '{"ResultsByTime":[{"Total":{"UnblendedCost":{"Amount":"1.23","Unit":"USD"}},"TimePeriod":{"Start":"2024-01-01","End":"2024-01-02"},"Estimated":false}]}'
    ;;
  *"s3api list-buckets"*)
    echo '{"Buckets":[]}'
    ;;
  *"s3api list-objects"*)
    echo '{"Contents":[]}'
    ;;
  *"lambda list-functions"*)
    echo '{"Functions":[]}'
    ;;
  *"ecs list-clusters"*)
    echo '{"clusterArns":[]}'
    ;;
  *"ecs list-services"*)
    echo '{"serviceArns":[]}'
    ;;
  *"logs describe-log-groups"*)
    echo '{"logGroups":[]}'
    ;;
  *"sqs list-queues"*)
    echo '{"QueueUrls":[]}'
    ;;
  *)
    echo "{}"
    ;;
esac
