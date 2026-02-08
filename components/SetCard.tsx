import React, { View, Text, StyleSheet, TouchableOpacity, GestureResponderEvent } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

interface SetCardProps {
  setNumber: number;
  weight: number;
  reps?: number;
  duration?: number;
  rir?: number | null;
  isPR?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onPress?: () => void;
}

export function SetCard({
  setNumber,
  weight,
  reps,
  duration,
  rir,
  isPR = false,
  onEdit,
  onDelete,
  onPress,
}: SetCardProps) {
  let swipeableRef: Swipeable | null = null;

  const renderRightActions = () => {
    if (!onEdit && !onDelete) return null;

    return (
      <View style={styles.actionsContainer}>
        {onEdit && (
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => {
              swipeableRef?.close();
              onEdit();
            }}
          >
            <Text style={styles.actionButtonText}>Editar</Text>
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => {
              swipeableRef?.close();
              onDelete();
            }}
          >
            <Text style={styles.actionButtonText}>Excluir</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const content = (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.container, isPR && styles.prContainer]}
    >
      <View style={styles.leftSection}>
        <Text style={styles.setNumber}>#{setNumber}</Text>
        {isPR && <View style={styles.prBadge}><Text style={styles.prText}>PR</Text></View>}
      </View>

      <View style={styles.middleSection}>
        <Text style={styles.mainText}>
          {weight > 0 ? `${weight}kg × ` : ''}
          {duration !== undefined ? `${duration}s` : `${reps || 0} reps`}
        </Text>
      </View>

      <View style={styles.rightSection}>
        {rir !== null && rir !== undefined && (
          <Text style={[styles.rirText, getRirColor(rir)]}>RIR {rir}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (onEdit || onDelete) {
    return (
      <Swipeable
        ref={(ref) => { swipeableRef = ref; }}
        renderRightActions={renderRightActions}
        rightThreshold={40}
      >
        {content}
      </Swipeable>
    );
  }

  return content;
}

const getRirColor = (rir: number) => {
  if (rir <= 1) return { color: '#EF6464' }; // Red - near failure
  if (rir <= 3) return { color: '#81B29A' }; // Green - good range
  return { color: '#3D5A80' }; // Blue - light
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
  },
  prContainer: {
    borderColor: '#F2CC8F',
    backgroundColor: '#FFFBF0',
  },
  leftSection: {
    marginRight: 12,
    alignItems: 'center',
  },
  setNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  prBadge: {
    backgroundColor: '#F2CC8F',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  prText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3D405B',
  },
  middleSection: {
    flex: 1,
  },
  mainText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3D405B',
  },
  rightSection: {
    marginLeft: 12,
  },
  rirText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -1,
  },
  actionButton: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#3D5A80',
  },
  deleteButton: {
    backgroundColor: '#EF6464',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
