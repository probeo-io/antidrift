FROM node:20-slim

WORKDIR /build

# Copy all 20 connector packages + core
COPY packages/mcp-github/ packages/mcp-github/
COPY packages/mcp-linear/ packages/mcp-linear/
COPY packages/mcp-attio/ packages/mcp-attio/
COPY packages/mcp-clickup/ packages/mcp-clickup/
COPY packages/mcp-cloudflare/ packages/mcp-cloudflare/
COPY packages/mcp-vercel/ packages/mcp-vercel/
COPY packages/mcp-netlify/ packages/mcp-netlify/
COPY packages/mcp-pipedrive/ packages/mcp-pipedrive/
COPY packages/mcp-hubspot-crm/ packages/mcp-hubspot-crm/
COPY packages/mcp-hubspot-marketing/ packages/mcp-hubspot-marketing/
COPY packages/mcp-jira/ packages/mcp-jira/
COPY packages/mcp-notion/ packages/mcp-notion/
COPY packages/mcp-stripe/ packages/mcp-stripe/
COPY packages/mcp-aws/ packages/mcp-aws/
COPY packages/mcp-aws-s3/ packages/mcp-aws-s3/
COPY packages/mcp-aws-spot/ packages/mcp-aws-spot/
COPY packages/mcp-calendar/ packages/mcp-calendar/
COPY packages/mcp-drive/ packages/mcp-drive/
COPY packages/mcp-gmail/ packages/mcp-gmail/
COPY packages/mcp-google/ packages/mcp-google/
COPY packages/core/ packages/core/

# Pack all packages into tarballs
RUN mkdir -p /tarballs && \
    cd packages/mcp-github && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-linear && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-attio && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-clickup && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-cloudflare && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-vercel && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-netlify && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-pipedrive && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-hubspot-crm && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-hubspot-marketing && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-jira && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-notion && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-stripe && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-aws && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-aws-s3 && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-aws-spot && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-calendar && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-drive && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-gmail && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/mcp-google && npm pack --pack-destination /tarballs/ && \
    cd /build/packages/core && npm pack --pack-destination /tarballs/

# Install REST connector CLIs globally
RUN npm install -g /tarballs/antidrift-mcp-github-*.tgz
RUN npm install -g /tarballs/antidrift-mcp-linear-*.tgz
RUN npm install -g /tarballs/antidrift-mcp-attio-*.tgz
RUN npm install -g /tarballs/antidrift-mcp-clickup-*.tgz
RUN npm install -g /tarballs/antidrift-mcp-cloudflare-*.tgz
RUN npm install -g /tarballs/antidrift-mcp-vercel-*.tgz
RUN npm install -g /tarballs/antidrift-mcp-netlify-*.tgz
RUN npm install -g /tarballs/antidrift-mcp-pipedrive-*.tgz
RUN npm install -g /tarballs/antidrift-mcp-hubspot-crm-*.tgz
RUN npm install -g /tarballs/antidrift-mcp-hubspot-marketing-*.tgz
RUN npm install -g /tarballs/antidrift-mcp-jira-*.tgz
RUN npm install -g /tarballs/antidrift-mcp-notion-*.tgz
RUN npm install -g /tarballs/antidrift-mcp-stripe-*.tgz
RUN npm install -g /tarballs/antidrift-mcp-calendar-*.tgz
RUN npm install -g /tarballs/antidrift-mcp-drive-*.tgz
RUN npm install -g /tarballs/antidrift-mcp-gmail-*.tgz
RUN npm install -g /tarballs/antidrift-mcp-google-*.tgz

# Install AWS connector CLIs (installed separately to avoid glob ambiguity)
RUN npm install -g /tarballs/antidrift-mcp-aws-s3-*.tgz
RUN npm install -g /tarballs/antidrift-mcp-aws-spot-*.tgz
RUN find /tarballs -maxdepth 1 -name 'antidrift-mcp-aws-[0-9]*' | xargs npm install -g

# Install core globally (for antidrift binary)
RUN npm install -g /tarballs/antidrift-core-*.tgz

# Install a fake AWS CLI for testing (returns mock data for mcp-aws/mcp-aws-s3/mcp-aws-spot)
COPY test/docker/fake-aws.sh /usr/local/bin/aws
RUN chmod +x /usr/local/bin/aws

# Pre-warm npm cache for packages installed by connectors at runtime
# (googleapis, stripe, AWS SDKs). This speeds up connector -g installs in tests.
RUN mkdir -p /tmp/npm-warmup && \
    echo '{"type":"module","dependencies":{"googleapis":"*","stripe":"*","@aws-sdk/client-s3":"*","@aws-sdk/s3-request-presigner":"*","@aws-sdk/client-ec2":"*"}}' \
        > /tmp/npm-warmup/package.json && \
    cd /tmp/npm-warmup && npm install --silent

# Pre-install @antidrift/zeromcp from npm into ~/.antidrift/mcp-server/
# (mirrors what installZeroMcp does at runtime)
RUN mkdir -p /root/.antidrift/mcp-server && \
    echo '{"type":"module"}' > /root/.antidrift/mcp-server/package.json && \
    cd /root/.antidrift/mcp-server && npm install @antidrift/zeromcp@latest --silent

COPY test/docker/test.sh /test.sh
COPY test/docker/mcp-call.mjs /mcp-call.mjs
RUN chmod +x /test.sh

CMD ["/test.sh"]
