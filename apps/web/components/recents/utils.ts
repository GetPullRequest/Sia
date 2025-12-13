// Get badge styling based on activity name
export const getActivityNameBadge = (name: string) => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('created')) {
    return {
      label: name,
      badge: 'bg-emerald-500/10 text-emerald-500 border border-emerald-400/40',
    };
  }
  if (nameLower.includes('updated')) {
    return {
      label: name,
      badge: 'bg-sky-500/10 text-sky-400 border border-sky-400/40',
    };
  }
  if (nameLower.includes('completed')) {
    return {
      label: name,
      badge: 'bg-emerald-500/10 text-emerald-500 border border-emerald-400/40',
    };
  }
  if (nameLower.includes('failed')) {
    return {
      label: name,
      badge: 'bg-rose-500/10 text-rose-400 border border-rose-400/40',
    };
  }
  if (nameLower.includes('deleted')) {
    return {
      label: name,
      badge: 'bg-red-500/10 text-red-400 border border-red-400/40',
    };
  }
  if (nameLower.includes('execution') || nameLower.includes('started')) {
    return {
      label: name,
      badge: 'bg-blue-500/10 text-blue-400 border border-blue-400/40',
    };
  }
  if (nameLower.includes('order')) {
    return {
      label: name,
      badge: 'bg-purple-500/10 text-purple-400 border border-purple-400/40',
    };
  }
  return {
    label: name,
    badge: 'bg-muted/40 text-muted-foreground border border-border/50',
  };
};
