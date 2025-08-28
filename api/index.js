{
  "username": "Datto RMM",
  "icon_url": "https://i.imgur.com/YJhsAgQ.png",
  "text": "🚨 **RMM Alert Notification**",
  "attachments": [
    {
      "color": "#ff6b35",
      "fallback": "[alert_type] Alert: [alert_message_en]",
      "title": "[alert_type] Alert",
      "title_link": "https://[platform].rmm.datto.com/alert/[alert_uid]",
      "text": "**Priority:** [alert_priority]\n\n[alert_message_en]",
      "fields": [
        {
          "title": "Site",
          "value": "[site_name]",
          "short": true
        },
        {
          "title": "Device",
          "value": "[device_hostname]",
          "short": true
        },
        {
          "title": "IP Address",
          "value": "[device_ip]",
          "short": true
        },
        {
          "title": "Last User",
          "value": "[last_user]",
          "short": true
        },
        {
          "title": "Operating System",
          "value": "[device_os]",
          "short": true
        },
        {
          "title": "Description",
          "value": "[device_description]",
          "short": false
        }
      ],
      "actions": [
        {
          "name": "View Device",
          "integration": {
            "url": "https://[platform].rmm.datto.com/device/[device_id]",
            "context": {
              "action": "view_device"
            }
          }
        },
        {
          "name": "View Site",
          "integration": {
            "url": "https://[platform].rmm.datto.com/site/[site_id]",
            "context": {
              "action": "view_site"
            }
          }
        },
        {
          "name": "Web Remote",
          "integration": {
            "url": "https://[platform].centrastage.net/csm/remote/rto/[device_id]",
            "context": {
              "action": "remote_access"
            }
          }
        }
      ],
      "footer": "Datto RMM Alert",
      "ts": "[timestamp]"
    }
  ]
}
