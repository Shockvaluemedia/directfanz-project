import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import FastImage from 'react-native-fast-image';

interface Subscription {
  id: string;
  status: string;
  amount: number;
  currentPeriodEnd: string;
  tiers: {
    name: string;
    description: string;
    minimumPrice: number;
    users: {
      id: string;
      displayName: string;
      avatar?: string;
    };
  };
}

export default function SubscriptionsScreen() {
  const { theme } = useTheme();
  const { token } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://directfanz.io';
      const response = await fetch(`${apiUrl}/api/fan/subscriptions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data.data?.subscriptions || []);
      }
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleCancel = (subscription: Subscription) => {
    Alert.alert(
      'Cancel Subscription',
      `Are you sure you want to cancel your ${subscription.tiers.name} subscription to ${subscription.tiers.users.displayName}?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            try {
              const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://directfanz.io';
              await fetch(`${apiUrl}/api/fan/subscriptions/${subscription.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              fetchSubscriptions();
            } catch {
              Alert.alert('Error', 'Failed to cancel subscription. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderSubscription = ({ item }: { item: Subscription }) => (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.cardHeader}>
        <FastImage
          style={styles.avatar}
          source={{
            uri: item.tiers.users.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.tiers.users.displayName)}`,
            priority: FastImage.priority.normal,
          }}
          resizeMode={FastImage.resizeMode.cover}
        />
        <View style={styles.artistInfo}>
          <Text style={[styles.artistName, { color: theme.colors.text }]}>
            {item.tiers.users.displayName}
          </Text>
          <Text style={[styles.tierName, { color: theme.colors.textSecondary }]}>
            {item.tiers.name}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'ACTIVE' ? theme.colors.primary + '20' : theme.colors.error + '20' }]}>
          <Text style={[styles.statusText, { color: item.status === 'ACTIVE' ? theme.colors.primary : theme.colors.error }]}>
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Monthly</Text>
          <Text style={[styles.detailValue, { color: theme.colors.text }]}>${item.amount}/mo</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Renews</Text>
          <Text style={[styles.detailValue, { color: theme.colors.text }]}>
            {new Date(item.currentPeriodEnd).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {item.status === 'ACTIVE' && (
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: theme.colors.error }]}
          onPress={() => handleCancel(item)}
        >
          <Text style={[styles.cancelButtonText, { color: theme.colors.error }]}>Cancel Subscription</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>My Subscriptions</Text>
      {subscriptions.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            You don't have any active subscriptions yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={subscriptions}
          keyExtractor={item => item.id}
          renderItem={renderSubscription}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchSubscriptions(); }}
              tintColor={theme.colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', paddingHorizontal: 16, marginBottom: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  artistInfo: { flex: 1, marginLeft: 12 },
  artistName: { fontSize: 16, fontWeight: '600' },
  tierName: { fontSize: 14, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },
  cardDetails: { marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '500' },
  cancelButton: { borderWidth: 1, borderRadius: 8, padding: 10, alignItems: 'center' },
  cancelButtonText: { fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 16, textAlign: 'center', paddingHorizontal: 32 },
});
