import request from 'supertest';
import { app } from '../../server/config/app';

describe('Metrics endpoint', () => {
  it('exposes request metrics and aggregates completed requests', async () => {
    const healthResponse = await request(app).get('/health');

    expect(healthResponse.status).toBe(200);

    const prometheusResponse = await request(app).get('/metrics');
    const firstMetricsResponse = await request(app).get('/api/v1/metrics');
    const secondMetricsResponse = await request(app).get('/api/v1/metrics');

    expect(prometheusResponse.status).toBe(200);
    expect(prometheusResponse.text).toContain('# HELP tranzor_mongodb_command_duration_ms');
    expect(prometheusResponse.text).toContain('# HELP tranzor_mongodb_pool_checkout_duration_ms');
    expect(firstMetricsResponse.status).toBe(200);
    expect(secondMetricsResponse.status).toBe(200);
    expect(prometheusResponse.text).toMatch(
      /tranzor_http_request_duration_ms_bucket\{[^}]*route="\/health"[^}]*\}/,
    );
    expect(secondMetricsResponse.body.success).toBe(true);
    expect(secondMetricsResponse.body.metrics).toBeDefined();
    expect(secondMetricsResponse.body.metrics.totalRequests).toBeGreaterThanOrEqual(2);
    expect(secondMetricsResponse.body.metrics.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(secondMetricsResponse.body.metrics.memoryUsage).toBeDefined();
    expect(secondMetricsResponse.body.metrics.requestsByRoute['GET /health'].count).toBeGreaterThanOrEqual(1);
    expect(secondMetricsResponse.body.metrics.requestsByRoute['GET /api/v1/metrics'].count).toBeGreaterThanOrEqual(1);
  });
});
