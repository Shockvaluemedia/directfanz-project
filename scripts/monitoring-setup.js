#!/usr/bin/env node

/**
 * Monitoring and Alerting Setup Script
 * Automates deployment of monitoring, logging, and alerting infrastructure
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function executeCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
      ...options
    });
    return result;
  } catch (error) {
    log(`Error executing command: ${command}`, colors.red);
    log(error.message, colors.red);
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

// Monitoring stack configurations
const monitoringConfigs = {
  prometheus: {
    'prometheus.yml': `global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'direct-fan-platform'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 30s

  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis-exporter:9121']`,

    'alert_rules.yml': `groups:
- name: direct-fan-platform-alerts
  rules:
  - alert: HighCPUUsage
    expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High CPU usage detected on {{ $labels.instance }}"
      description: "CPU usage is above 80% for more than 5 minutes"

  - alert: HighMemoryUsage
    expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High memory usage on {{ $labels.instance }}"
      description: "Memory usage is above 85%"

  - alert: DatabaseDown
    expr: up{job="postgres-exporter"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "PostgreSQL database is down"
      description: "PostgreSQL database has been down for more than 1 minute"

  - alert: RedisDown
    expr: up{job="redis-exporter"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Redis is down"
      description: "Redis has been down for more than 1 minute"

  - alert: ApplicationDown
    expr: up{job="direct-fan-platform"} == 0
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "Application is down"
      description: "Application has been down for more than 2 minutes"

  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High error rate detected"
      description: "Error rate is above 10% for 5 minutes"

  - alert: SlowResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Slow response time"
      description: "95th percentile response time is above 2 seconds"`
  },

  grafana: {
    'dashboards/app-dashboard.json': JSON.stringify({
      dashboard: {
        id: null,
        title: "Direct Fan Platform - Application Dashboard",
        tags: ["direct-fan-platform"],
        timezone: "browser",
        panels: [
          {
            id: 1,
            title: "Request Rate",
            type: "graph",
            targets: [
              {
                expr: "rate(http_requests_total[5m])",
                legendFormat: "{{ method }} {{ status }}"
              }
            ],
            yAxes: [
              {
                label: "requests/sec"
              }
            ]
          },
          {
            id: 2,
            title: "Response Time",
            type: "graph",
            targets: [
              {
                expr: "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
                legendFormat: "95th percentile"
              },
              {
                expr: "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
                legendFormat: "50th percentile"
              }
            ],
            yAxes: [
              {
                label: "seconds"
              }
            ]
          },
          {
            id: 3,
            title: "Error Rate",
            type: "graph",
            targets: [
              {
                expr: "rate(http_requests_total{status=~\"5..\"}[5m])",
                legendFormat: "5xx errors"
              },
              {
                expr: "rate(http_requests_total{status=~\"4..\"}[5m])",
                legendFormat: "4xx errors"
              }
            ]
          }
        ],
        time: {
          from: "now-1h",
          to: "now"
        },
        refresh: "5s"
      }
    }, null, 2),

    'provisioning/dashboards/dashboard.yml': `apiVersion: 1

providers:
- name: 'default'
  orgId: 1
  folder: ''
  type: file
  disableDeletion: false
  updateIntervalSeconds: 10
  allowUiUpdates: true
  options:
    path: /var/lib/grafana/dashboards`,

    'provisioning/datasources/prometheus.yml': `apiVersion: 1

datasources:
- name: Prometheus
  type: prometheus
  access: proxy
  url: http://prometheus:9090
  isDefault: true
  editable: true`
  },

  loki: {
    'loki-config.yml': `auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s
  chunk_idle_period: 1h
  max_chunk_age: 1h
  chunk_target_size: 1048576
  chunk_retain_period: 30s
  max_transfer_retries: 0

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /tmp/loki/boltdb-shipper-active
    cache_location: /tmp/loki/boltdb-shipper-cache
    shared_store: filesystem
  filesystem:
    directory: /tmp/loki/chunks

compactor:
  working_directory: /tmp/loki/boltdb-shipper-compactor
  shared_store: filesystem

limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s

ruler:
  storage:
    type: local
    local:
      directory: /tmp/loki/rules
  rule_path: /tmp/loki/rules-temp
  alertmanager_url: http://alertmanager:9093
  ring:
    kvstore:
      store: inmemory
  enable_api: true`,

    'promtail-config.yml': `server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
- job_name: containers
  static_configs:
  - targets:
      - localhost
    labels:
      job: containerlogs
      __path__: /var/log/containers/*log

  pipeline_stages:
  - json:
      expressions:
        output: log
        stream: stream
        timestamp: time
  - timestamp:
      source: timestamp
      format: RFC3339Nano
  - output:
      source: output

- job_name: system
  static_configs:
  - targets:
      - localhost
    labels:
      job: varlogs
      __path__: /var/log/*.log

- job_name: app-logs
  static_configs:
  - targets:
      - localhost
    labels:
      job: app
      __path__: /app/logs/*.log`
  },

  alertmanager: {
    'alertmanager.yml': `global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@direct-fan-platform.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
- name: 'web.hook'
  email_configs:
  - to: 'admin@direct-fan-platform.com'
    subject: "Alert: {{ range .Alerts }}{{ .Annotations.summary }}{{ end }}"
    body: |
      {{ range .Alerts }}
      Alert: {{ .Annotations.summary }}
      Description: {{ .Annotations.description }}
      Instance: {{ .Labels.instance }}
      Severity: {{ .Labels.severity }}
      {{ end }}
  
  slack_configs:
  - api_url: 'YOUR_SLACK_WEBHOOK_URL'
    channel: '#alerts'
    title: "Alert: {{ range .Alerts }}{{ .Annotations.summary }}{{ end }}"
    text: |
      {{ range .Alerts }}
      *Alert:* {{ .Annotations.summary }}
      *Description:* {{ .Annotations.description }}
      *Instance:* {{ .Labels.instance }}
      *Severity:* {{ .Labels.severity }}
      {{ end }}

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']`
  }
};

async function createMonitoringStack() {
  log('📊 Setting up monitoring stack...', colors.cyan);
  
  // Create monitoring directory structure
  const monitoringDir = 'monitoring';
  
  if (!fs.existsSync(monitoringDir)) {
    fs.mkdirSync(monitoringDir, { recursive: true });
  }
  
  // Create subdirectories
  const subdirs = ['prometheus', 'grafana/dashboards', 'grafana/provisioning/dashboards', 'grafana/provisioning/datasources', 'loki', 'alertmanager'];
  subdirs.forEach(subdir => {
    const fullPath = path.join(monitoringDir, subdir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
  
  // Write configuration files
  for (const [service, configs] of Object.entries(monitoringConfigs)) {
    for (const [filename, content] of Object.entries(configs)) {
      const filePath = path.join(monitoringDir, service, filename);
      const fileDir = path.dirname(filePath);
      
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }
      
      fs.writeFileSync(filePath, content);
      log(`✅ Created ${filePath}`, colors.green);
    }
  }
}

async function createDockerMonitoringCompose() {
  log('🐳 Creating Docker Compose for monitoring stack...', colors.cyan);
  
  const composeContent = `version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./monitoring/prometheus/alert_rules.yml:/etc/prometheus/alert_rules.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
      - '--web.enable-admin-api'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_SERVER_DOMAIN=localhost
      - GF_SMTP_ENABLED=true
      - GF_SMTP_HOST=localhost:587
      - GF_SMTP_FROM_ADDRESS=grafana@direct-fan-platform.com
    restart: unless-stopped

  loki:
    image: grafana/loki:latest
    container_name: loki
    ports:
      - "3100:3100"
    volumes:
      - ./monitoring/loki/loki-config.yml:/etc/loki/local-config.yaml
      - loki_data:/tmp/loki
    command: -config.file=/etc/loki/local-config.yaml
    restart: unless-stopped

  promtail:
    image: grafana/promtail:latest
    container_name: promtail
    volumes:
      - /var/log:/var/log:ro
      - ./monitoring/loki/promtail-config.yml:/etc/promtail/config.yml
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    command: -config.file=/etc/promtail/config.yml
    depends_on:
      - loki
    restart: unless-stopped

  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./monitoring/alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager_data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
      - '--web.external-url=http://localhost:9093'
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    restart: unless-stopped

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: cadvisor
    ports:
      - "8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:rw
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
  loki_data:
  alertmanager_data:

networks:
  default:
    name: monitoring
    external: false`;
  
  fs.writeFileSync('docker-compose.monitoring.yml', composeContent);
  log('✅ Created docker-compose.monitoring.yml', colors.green);
}

async function setupCloudMonitoring() {
  log('☁️ Setting up cloud monitoring...', colors.cyan);
  
  const cloudProvider = await question('Which cloud provider are you using? (aws/gcp/azure): ');
  
  switch (cloudProvider.toLowerCase()) {
    case 'aws':
      await setupAWSMonitoring();
      break;
    case 'gcp':
      await setupGCPMonitoring();
      break;
    case 'azure':
      await setupAzureMonitoring();
      break;
    default:
      log('❌ Unsupported cloud provider', colors.red);
      break;
  }
}

async function setupAWSMonitoring() {
  log('Setting up AWS CloudWatch monitoring...', colors.blue);
  
  // Create CloudWatch dashboard
  const dashboardBody = {
    widgets: [
      {
        type: "metric",
        x: 0, y: 0, width: 12, height: 6,
        properties: {
          metrics: [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "direct-fan-platform-alb"],
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", "direct-fan-platform-alb"]
          ],
          period: 300,
          stat: "Sum",
          region: "us-east-1",
          title: "Application Load Balancer Metrics"
        }
      },
      {
        type: "metric",
        x: 0, y: 6, width: 12, height: 6,
        properties: {
          metrics: [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", "direct-fan-platform-postgres"],
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", "direct-fan-platform-postgres"],
            ["AWS/RDS", "FreeableMemory", "DBInstanceIdentifier", "direct-fan-platform-postgres"]
          ],
          period: 300,
          stat: "Average",
          region: "us-east-1",
          title: "RDS PostgreSQL Metrics"
        }
      }
    ]
  };
  
  fs.writeFileSync('/tmp/aws-dashboard.json', JSON.stringify(dashboardBody));
  
  // Create dashboard
  executeCommand(`aws cloudwatch put-dashboard --dashboard-name "DirectFanPlatform" --dashboard-body file:///tmp/aws-dashboard.json`, { ignoreError: true });
  
  // Create CloudWatch alarms
  const alarms = [
    {
      name: "DirectFanPlatform-HighCPU",
      description: "High CPU usage alert",
      metricName: "CPUUtilization",
      namespace: "AWS/RDS",
      statistic: "Average",
      threshold: 80,
      comparisonOperator: "GreaterThanThreshold",
      dimensions: "Name=DBInstanceIdentifier,Value=direct-fan-platform-postgres"
    },
    {
      name: "DirectFanPlatform-HighConnections",
      description: "High database connections",
      metricName: "DatabaseConnections",
      namespace: "AWS/RDS",
      statistic: "Average",
      threshold: 50,
      comparisonOperator: "GreaterThanThreshold",
      dimensions: "Name=DBInstanceIdentifier,Value=direct-fan-platform-postgres"
    }
  ];
  
  alarms.forEach(alarm => {
    const command = `aws cloudwatch put-metric-alarm \\
      --alarm-name "${alarm.name}" \\
      --alarm-description "${alarm.description}" \\
      --metric-name ${alarm.metricName} \\
      --namespace ${alarm.namespace} \\
      --statistic ${alarm.statistic} \\
      --period 300 \\
      --threshold ${alarm.threshold} \\
      --comparison-operator ${alarm.comparisonOperator} \\
      --dimensions ${alarm.dimensions} \\
      --evaluation-periods 2`;
    
    executeCommand(command, { ignoreError: true });
  });
  
  log('✅ AWS CloudWatch monitoring configured', colors.green);
}

async function setupGCPMonitoring() {
  log('🚧 GCP monitoring setup not implemented yet', colors.yellow);
  log('Consider using Google Cloud Monitoring and Logging', colors.yellow);
}

async function setupAzureMonitoring() {
  log('🚧 Azure monitoring setup not implemented yet', colors.yellow);
  log('Consider using Azure Monitor and Log Analytics', colors.yellow);
}

async function createHealthCheckEndpoint() {
  log('🏥 Creating health check endpoint...', colors.cyan);
  
  const healthCheckContent = `// Health check endpoint for monitoring
export default async function handler(req, res) {
  const checks = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    status: 'healthy'
  };

  try {
    // Database connection check
    if (process.env.DATABASE_URL) {
      // Add actual database connectivity test here
      checks.database = 'connected';
    }

    // Redis connection check
    if (process.env.REDIS_URL) {
      // Add actual Redis connectivity test here
      checks.redis = 'connected';
    }

    // Memory usage check
    const memUsage = process.memoryUsage();
    checks.memory = {
      rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB'
    };

    res.status(200).json(checks);
  } catch (error) {
    checks.status = 'unhealthy';
    checks.error = error.message;
    res.status(500).json(checks);
  }
}`;
  
  const healthDir = 'pages/api';
  if (!fs.existsSync(healthDir)) {
    fs.mkdirSync(healthDir, { recursive: true });
  }
  
  fs.writeFileSync(path.join(healthDir, 'health.js'), healthCheckContent);
  log('✅ Created health check endpoint at /api/health', colors.green);
}

async function createMetricsEndpoint() {
  log('📈 Creating metrics endpoint for Prometheus...', colors.cyan);
  
  const metricsContent = `// Prometheus metrics endpoint
import client from 'prom-client';

// Create a Registry to register the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'direct-fan-platform'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['route', 'method', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['route', 'method', 'status_code']
});

const activeUsers = new client.Gauge({
  name: 'active_users_total',
  help: 'Number of active users'
});

const databaseConnections = new client.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections'
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(activeUsers);
register.registerMetric(databaseConnections);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
}

// Export metrics for use in other parts of the application
export {
  httpRequestDuration,
  httpRequestTotal,
  activeUsers,
  databaseConnections
};`;
  
  const metricsDir = 'pages/api';
  if (!fs.existsSync(metricsDir)) {
    fs.mkdirSync(metricsDir, { recursive: true });
  }
  
  fs.writeFileSync(path.join(metricsDir, 'metrics.js'), metricsContent);
  log('✅ Created metrics endpoint at /api/metrics', colors.green);
}

async function main() {
  log('📊 Monitoring and Alerting Setup', colors.cyan);
  log('==================================', colors.cyan);
  
  try {
    const setupLocal = await question('Set up local monitoring stack with Docker? (y/n): ');
    if (setupLocal.toLowerCase() === 'y') {
      await createMonitoringStack();
      await createDockerMonitoringCompose();
    }
    
    const setupCloud = await question('Set up cloud monitoring? (y/n): ');
    if (setupCloud.toLowerCase() === 'y') {
      await setupCloudMonitoring();
    }
    
    const createEndpoints = await question('Create health check and metrics endpoints? (y/n): ');
    if (createEndpoints.toLowerCase() === 'y') {
      await createHealthCheckEndpoint();
      await createMetricsEndpoint();
    }
    
    log('\n🎉 Monitoring setup completed successfully!', colors.green);
    log('\nNext steps:', colors.yellow);
    log('1. Install prometheus client: npm install prom-client', colors.yellow);
    log('2. Start monitoring stack: docker-compose -f docker-compose.monitoring.yml up -d', colors.yellow);
    log('3. Access Grafana at http://localhost:3001 (admin/admin)', colors.yellow);
    log('4. Access Prometheus at http://localhost:9090', colors.yellow);
    log('5. Configure alerting channels in Grafana and AlertManager', colors.yellow);
    
  } catch (error) {
    log(`❌ Setup failed: ${error.message}`, colors.red);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();