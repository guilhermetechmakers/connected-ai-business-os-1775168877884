import {
  ActivityStream,
  type ActivityStreamProps,
} from "@/components/unified-data/activity-stream";

export type ActivityFeedProps = ActivityStreamProps;

export function ActivityFeed(props: ActivityFeedProps) {
  return <ActivityStream {...props} />;
}
