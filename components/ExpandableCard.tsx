import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ViewProps } from 'react-native';
import { Card } from '@/components/Card';
import { colors } from '@/constants/colors';
import { ChevronDown } from 'lucide-react-native';

interface ExpandableCardProps extends ViewProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  rightAccessory?: React.ReactNode;
  testID?: string;
}

export const ExpandableCard: React.FC<ExpandableCardProps> = ({
  title,
  children,
  defaultExpanded = true,
  rightAccessory,
  style,
  testID,
  ...rest
}) => {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);

  const toggle = useCallback(() => {
    console.log('[ExpandableCard] toggle', { title, expanded: !expanded });
    setExpanded((e) => !e);
  }, [title, expanded]);

  const chevronStyle = useMemo(() => (
    [styles.chevron, expanded ? styles.chevronOpen : styles.chevronClosed]
  ), [expanded]);

  return (
    <Card style={[styles.card, style]} {...rest}>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={toggle}
        style={styles.header}
        testID={testID ? `${testID}-toggle` : 'expandable-card-toggle'}
      >
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerRight}>
          {typeof rightAccessory === 'string' ? (
            <Text style={styles.accessoryText}>{rightAccessory}</Text>
          ) : (
            rightAccessory
          )}
          <ChevronDown size={18} color={colors.text} style={chevronStyle} />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content} testID={testID ? `${testID}-content` : 'expandable-card-content'}>
          {children}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accessoryText: {
    marginRight: 8,
    color: colors.text,
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  chevronClosed: {
    transform: [{ rotate: '0deg' }],
  },
  content: {
    marginTop: 8,
  },
});
