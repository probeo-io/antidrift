#!/usr/bin/env node

import { start } from '../server.mjs';

const port = parseInt(process.argv[2] || process.env.ANTIDRIFT_PORT || '4242', 10);
start(port);
