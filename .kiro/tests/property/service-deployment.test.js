/**
 * Property Test: Service Deployment with Auto-scaling
 * Validates: Requirements 3.2
 * 
 * Property 8: Service deployment with auto-scaling
 * - ECS services are deployed with correct configurations
 * - Auto-scaling policies are properly configured
 * - Health checks are functional
 */

const fs = require('fs');
const path = require('path');

describe('Property Test: Service Deployment with Auto-scaling', () => {
  const ecsTaskDefsDir = path.join(__dirname, '../../ecs-task-definitions');
  const terraformDir = path.join(__dirname, '../../infrastructure/terraform');

  test('Property 8.1: ECS task definitions are properly configured', () => {
    const taskDefinitionFiles = [
      'web-app-task.json',
      'websocket-task.json'
    ];

    taskDefinitionFiles.forEach(file => {
      const filePath = path.join(ecsTaskDefsDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
      
      const taskDef = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Verify essential task definition properties
      expect(taskDef.family).toBeDefined();
      expect(taskDef.networkMode).toBe('awsvpc');
      expect(taskDef.requiresCompatibilities).toContain('FARGATE');
      expect(taskDef.cpu).toBeDefined();
      expect(taskDef.memory).toBeDefined();
      
      // Verify container definitions
      expect(taskDef.containerDefinitions).toBeInstanceOf(Array);
      expect(taskDef.containerDefinitions.length).toBeGreaterThan(0);
      
      taskDef.containerDefinitions.forEach(container => {
        expect(container.name).toBeDefined();
        expect(container.image).toBeDefined();
        expect(container.portMappings).toBeInstanceOf(Array);
        
        // Verify health check configuration
        if (container.healthCheck) {
          expect(container.healthCheck.command).toBeInstanceOf(Array);
          expect(container.healthCheck.interval).toBeGreaterThan(0);
          expect(container.healthCheck.timeout).toBeGreaterThan(0);
          expect(container.healthCheck.retries).toBeGreaterThan(0);
        }
      });
    });
  });

  test('Property 8.2: ECS service configurations include auto-scaling', () => {
    const ecsConfigPath = path.join(terraformDir, 'ecs-fargate.tf');
    expect(fs.existsSync(ecsConfigPath)).toBe(true);
    
    const ecsConfig = fs.readFileSync(ecsConfigPath, 'utf8');
    
    // Verify ECS service resources
    expect(ecsConfig).toContain('aws_ecs_cluster');
    expect(ecsConfig).toContain('aws_ecs_service');
    expect(ecsConfig).toContain('aws_ecs_task_definition');
    
    // Verify auto-scaling configuration
    expect(ecsConfig).toContain('aws_appautoscaling_target');
    expect(ecsConfig).toContain('aws_appautoscaling_policy');
    
    // Verify service discovery
    expect(ecsConfig).toContain('service_registries');
  });

  test('Property 8.3: Auto-scaling policies are properly defined', () => {
    const ecsConfigPath = path.join(terraformDir, 'ecs-fargate.tf');
    const ecsConfig = fs.readFileSync(ecsConfigPath, 'utf8');
    
    // Check for CPU-based scaling
    expect(ecsConfig).toMatch(/target_tracking_scaling_policy_configuration\s*{[\s\S]*target_value/);
    expect(ecsConfig).toMatch(/predefined_metric_specification\s*{[\s\S]*ECSServiceAverageCPUUtilization/);
    
    // Check for memory-based scaling (if configured)
    const memoryScalingRegex = /ECSServiceAverageMemoryUtilization/;
    if (memoryScalingRegex.test(ecsConfig)) {
      expect(ecsConfig).toMatch(/predefined_metric_specification\s*{[\s\S]*ECSServiceAverageMemoryUtilization/);
    }
  });

  test('Property 8.4: Service capacity limits are production-appropriate', () => {
    const tfvarsPath = path.join(terraformDir, 'terraform.tfvars');
    const tfvarsContent = fs.readFileSync(tfvarsPath, 'utf8');
    
    // Extract capacity values
    const webAppMinMatch = tfvarsContent.match(/web_app_min_capacity\s*=\s*(\d+)/);
    const webAppMaxMatch = tfvarsContent.match(/web_app_max_capacity\s*=\s*(\d+)/);
    const webAppDesiredMatch = tfvarsContent.match(/web_app_desired_count\s*=\s*(\d+)/);
    
    expect(webAppMinMatch).toBeTruthy();
    expect(webAppMaxMatch).toBeTruthy();
    expect(webAppDesiredMatch).toBeTruthy();
    
    const minCapacity = parseInt(webAppMinMatch[1]);
    const maxCapacity = parseInt(webAppMaxMatch[1]);
    const desiredCount = parseInt(webAppDesiredMatch[1]);
    
    // Verify production-appropriate scaling limits
    expect(minCapacity).toBeGreaterThanOrEqual(2); // High availability
    expect(maxCapacity).toBeGreaterThan(minCapacity);
    expect(desiredCount).toBeGreaterThanOrEqual(minCapacity);
    expect(desiredCount).toBeLessThanOrEqual(maxCapacity);
    
    // Verify reasonable scaling range
    expect(maxCapacity / minCapacity).toBeGreaterThanOrEqual(2); // At least 2x scaling
  });

  test('Property 8.5: Health check configurations are comprehensive', () => {
    const loadBalancerPath = path.join(terraformDir, 'load-balancer.tf');
    expect(fs.existsSync(loadBalancerPath)).toBe(true);
    
    const lbConfig = fs.readFileSync(loadBalancerPath, 'utf8');
    
    // Verify target group health checks
    expect(lbConfig).toContain('aws_lb_target_group');
    expect(lbConfig).toContain('health_check');
    expect(lbConfig).toMatch(/healthy_threshold\s*=\s*\d+/);
    expect(lbConfig).toMatch(/unhealthy_threshold\s*=\s*\d+/);
    expect(lbConfig).toMatch(/timeout\s*=\s*\d+/);
    expect(lbConfig).toMatch(/interval\s*=\s*\d+/);
    expect(lbConfig).toMatch(/path\s*=\s*"[^"]+"/);
  });

  test('Property 8.6: Service networking is properly configured', () => {
    const ecsConfigPath = path.join(terraformDir, 'ecs-fargate.tf');
    const ecsConfig = fs.readFileSync(ecsConfigPath, 'utf8');
    
    // Verify network configuration
    expect(ecsConfig).toContain('network_configuration');
    expect(ecsConfig).toContain('subnets');
    expect(ecsConfig).toContain('security_groups');
    expect(ecsConfig).toContain('assign_public_ip');
    
    // Verify service discovery configuration
    expect(ecsConfig).toContain('service_registries');
    expect(ecsConfig).toMatch(/registry_arn\s*=\s*aws_service_discovery_service/);
  });

  test('Property 8.7: Container resource allocation is appropriate', () => {
    const tfvarsPath = path.join(terraformDir, 'terraform.tfvars');
    const tfvarsContent = fs.readFileSync(tfvarsPath, 'utf8');
    
    // Check web app resources
    const webAppCpuMatch = tfvarsContent.match(/web_app_cpu\s*=\s*(\d+)/);
    const webAppMemoryMatch = tfvarsContent.match(/web_app_memory\s*=\s*(\d+)/);
    
    expect(webAppCpuMatch).toBeTruthy();
    expect(webAppMemoryMatch).toBeTruthy();
    
    const webAppCpu = parseInt(webAppCpuMatch[1]);
    const webAppMemory = parseInt(webAppMemoryMatch[1]);
    
    // Verify production-appropriate resource allocation
    expect(webAppCpu).toBeGreaterThanOrEqual(512); // Minimum for production
    expect(webAppMemory).toBeGreaterThanOrEqual(1024); // Minimum for production
    
    // Verify CPU to memory ratio is reasonable (1:2 to 1:8 ratio)
    const ratio = webAppMemory / webAppCpu;
    expect(ratio).toBeGreaterThanOrEqual(1);
    expect(ratio).toBeLessThanOrEqual(8);
  });

  test('Property 8.8: Service deployment strategy is configured', () => {
    const ecsConfigPath = path.join(terraformDir, 'ecs-fargate.tf');
    const ecsConfig = fs.readFileSync(ecsConfigPath, 'utf8');
    
    // Verify deployment configuration
    expect(ecsConfig).toContain('deployment_configuration');
    expect(ecsConfig).toMatch(/maximum_percent\s*=\s*\d+/);
    expect(ecsConfig).toMatch(/minimum_healthy_percent\s*=\s*\d+/);
    
    // Check for blue-green deployment configuration if present
    const codedeployPath = path.join(terraformDir, 'codedeploy-bluegreen.tf');
    if (fs.existsSync(codedeployPath)) {
      const codedeployConfig = fs.readFileSync(codedeployPath, 'utf8');
      expect(codedeployConfig).toContain('aws_codedeploy_application');
      expect(codedeployConfig).toContain('aws_codedeploy_deployment_group');
    }
  });

  test('Property 8.9: Service logging is properly configured', () => {
    const taskDefinitionFiles = [
      'web-app-task.json',
      'websocket-task.json'
    ];

    taskDefinitionFiles.forEach(file => {
      const filePath = path.join(ecsTaskDefsDir, file);
      const taskDef = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      taskDef.containerDefinitions.forEach(container => {
        if (container.logConfiguration) {
          expect(container.logConfiguration.logDriver).toBe('awslogs');
          expect(container.logConfiguration.options).toBeDefined();
          expect(container.logConfiguration.options['awslogs-group']).toBeDefined();
          expect(container.logConfiguration.options['awslogs-region']).toBeDefined();
          expect(container.logConfiguration.options['awslogs-stream-prefix']).toBeDefined();
        }
      });
    });
  });

  test('Property 8.10: Service monitoring integration is configured', () => {
    const monitoringPath = path.join(terraformDir, 'cloudwatch-monitoring.tf');
    expect(fs.existsSync(monitoringPath)).toBe(true);
    
    const monitoringConfig = fs.readFileSync(monitoringPath, 'utf8');
    
    // Verify ECS service monitoring
    expect(monitoringConfig).toContain('aws_cloudwatch_metric_alarm');
    expect(monitoringConfig).toMatch(/metric_name\s*=\s*"CPUUtilization"/);
    expect(monitoringConfig).toMatch(/namespace\s*=\s*"AWS\/ECS"/);
    
    // Verify alarm actions
    expect(monitoringConfig).toContain('alarm_actions');
    expect(monitoringConfig).toContain('ok_actions');
  });
});