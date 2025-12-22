# PgBouncer Dockerfile for AWS ECS Deployment
FROM pgbouncer/pgbouncer:latest

# Install necessary tools
USER root
RUN apt-get update && apt-get install -y \
    envsubst \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy configuration files
COPY pgbouncer.ini /etc/pgbouncer/pgbouncer.ini.template
COPY userlist.txt /etc/pgbouncer/userlist.txt.template

# Create startup script
RUN cat > /usr/local/bin/start-pgbouncer.sh << 'EOF'
#!/bin/bash
set -e

# Generate MD5 hash for database user
DB_PASSWORD_HASH=$(echo -n "${DATABASES_PASSWORD}${DATABASES_USER}" | md5sum | cut -d' ' -f1)

# Create userlist.txt with actual credentials
echo "\"${DATABASES_USER}\" \"md5${DB_PASSWORD_HASH}\"" > /etc/pgbouncer/userlist.txt

# Substitute environment variables in pgbouncer.ini
envsubst < /etc/pgbouncer/pgbouncer.ini.template > /etc/pgbouncer/pgbouncer.ini

# Set proper permissions
chown pgbouncer:pgbouncer /etc/pgbouncer/pgbouncer.ini /etc/pgbouncer/userlist.txt
chmod 600 /etc/pgbouncer/userlist.txt

# Start PgBouncer
exec pgbouncer /etc/pgbouncer/pgbouncer.ini
EOF

RUN chmod +x /usr/local/bin/start-pgbouncer.sh

# Switch back to pgbouncer user
USER pgbouncer

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD pg_isready -h localhost -p 5432 || exit 1

# Expose port
EXPOSE 5432

# Start PgBouncer with custom script
CMD ["/usr/local/bin/start-pgbouncer.sh"]