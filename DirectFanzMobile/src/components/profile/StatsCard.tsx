import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { UserStats } from '../../types/profile';

interface StatsCardProps {
  stats?: UserStats;
  role: 'ARTIST' | 'FAN' | 'ADMIN';
}

const StatsCard: React.FC<StatsCardProps> = ({ stats, role }) => {
  const { theme } = useTheme();

  const formatNumber = (num: number | undefined): string => {
    if (!num) return '0';
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const formatCurrency = (amount: number | undefined): string => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 20,
      marginVertical: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 15,
      textAlign: 'center',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    statItem: {
      alignItems: 'center',
      width: '48%',
      marginBottom: 15,
    },
    statItemFull: {
      alignItems: 'center',
      width: '100%',
      marginBottom: 15,
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.primary,
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stars: {
      color: '#FFD700',
      fontSize: 16,
      marginLeft: 5,
    },
  });

  const renderArtistStats = () => {
    return (
      <>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {formatNumber(stats?.totalSubscribers)}
          </Text>
          <Text style={styles.statLabel}>Subscribers</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {formatCurrency(stats?.monthlyRevenue)}
          </Text>
          <Text style={styles.statLabel}>Monthly Revenue</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {formatNumber(stats?.contentCount)}
          </Text>
          <Text style={styles.statLabel}>Content Posts</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {formatNumber(stats?.totalViews)}
          </Text>
          <Text style={styles.statLabel}>Total Views</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {formatNumber(stats?.totalLikes)}
          </Text>
          <Text style={styles.statLabel}>Total Likes</Text>
        </View>
        
        <View style={styles.statItem}>
          <View style={styles.ratingContainer}>
            <Text style={styles.statValue}>
              {stats?.averageRating?.toFixed(1) || '0.0'}
            </Text>
            <Text style={styles.stars}>⭐</Text>
          </View>
          <Text style={styles.statLabel}>Average Rating</Text>
        </View>
      </>
    );
  };

  const renderFanStats = () => {
    return (
      <>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {formatNumber(stats?.subscriptionsCount)}
          </Text>
          <Text style={styles.statLabel}>Active Subscriptions</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {formatCurrency(stats?.totalSpent)}
          </Text>
          <Text style={styles.statLabel}>Total Spent</Text>
        </View>
        
        <View style={styles.statItemFull}>
          <Text style={styles.statValue}>
            {formatNumber(stats?.totalPurchases)}
          </Text>
          <Text style={styles.statLabel}>Total Purchases</Text>
        </View>
      </>
    );
  };

  if (!stats) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Statistics</Text>
        <Text style={[styles.statLabel, { textAlign: 'center' }]}>
          No statistics available yet
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {role === 'ARTIST' ? 'Creator Statistics' : 'My Activity'}
      </Text>
      <View style={styles.statsGrid}>
        {role === 'ARTIST' ? renderArtistStats() : renderFanStats()}
      </View>
    </View>
  );
};

export default StatsCard;